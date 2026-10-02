"""Carrega o plano de contas no Postgres — primeira fatia da Fase 1.

LÊ DE Referencias/contas.json, e não do .xlsx, de propósito. O contas.json é o
artefato já curado por carrega_cadastro.py (que descarta conta de balanço e
monta a linha do P&L a partir de FPA_Pacote) e enriquecido por
carrega_template_torres.py. Ele é também o formato que o GET /api/ref/contas
tem de reproduzir. Derivar de novo do .xlsx aqui criaria uma SEGUNDA tradução
das mesmas colunas — e duas traduções da mesma coisa saem de sincronia, que é o
defeito mais caro deste projeto (ver "as três palavras que significam duas
coisas" no CONTEXTO.md).

Preenche duas tabelas:
  cadastro.linha_pl   as linhas do P&L distintas, com ordem e sinal
  cadastro.conta      as contas, ligadas à sua linha

IDEMPOTENTE: pode rodar quantas vezes quiser. Conta que já existe é atualizada
pelo código; conta que sumiu da origem NÃO é apagada (só marcada inativa), porque
lançamento antigo aponta para ela e apagar quebraria a referência.

Uso:
    DATABASE_URL=postgresql://user:senha@localhost:5433/orcamento_dev \\
        python ferramentas/carrega_contas_no_banco.py [--dry-run]
"""
import json
import os
import sys

import psycopg2
import psycopg2.extras

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(RAIZ, "Referencias")

# O bridge do P&L: Revenue -> Expenses -> EBITDA -> Capex. A ordem aqui é a
# ordem de exibição, e o sinal diz se a linha soma ou subtrai no consolidado.
PREFIXOS = {
    "Receita":  (1, 1),    # (ordem do grupo, sinal)
    "Despesas": (2, -1),
    "Capex":    (3, -1),
}


def prefixo_de(linha_pl):
    return linha_pl.split(" >")[0] if " >" in linha_pl else linha_pl


def main():
    dry = "--dry-run" in sys.argv
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL ausente.")

    with open(os.path.join(REF, "contas.json"), encoding="utf-8") as fh:
        contas = json.load(fh)
    print(f"contas.json: {len(contas)} linhas")

    # ---- código repetido ----
    # cadastro.conta tem codigo UNIQUE, então um código repetido seria resolvido
    # pelo upsert: venceria a última linha do arquivo. Isso é decidir classificação
    # contábil por ordem de leitura — e em silêncio, que é o pior modo de errar.
    #
    # Repetição idêntica é ruído e se ignora. Repetição DIVERGENTE (mesmo código,
    # linha de P&L diferente) é pergunta de negócio: a conta pertence a qual linha?
    # Quem responde não é este script, então ele deixa a conta DE FORA e avisa.
    por_codigo = {}
    for c in contas:
        por_codigo.setdefault(c["conta"], []).append(c)

    conflitantes = {}
    for codigo, versoes in por_codigo.items():
        distintas = {json.dumps(v, sort_keys=True, ensure_ascii=False) for v in versoes}
        if len(distintas) > 1:
            conflitantes[codigo] = versoes

    if conflitantes:
        print(f"\n⚠ {len(conflitantes)} código(s) repetido(s) com conteúdo DIFERENTE — "
              f"não serão carregados:")
        for codigo, versoes in conflitantes.items():
            print(f"  {codigo}  {versoes[0].get('nome')}")
            for v in versoes:
                print(f"     linhaPL={v.get('linhaPL')!r}  categoria={v.get('categoria')!r}")
        print("  Corrija a origem (o gerador do contas.json) e rode de novo.\n")

    contas = [c for c in contas if c["conta"] not in conflitantes]
    print(f"a carregar: {len(contas)} contas")

    # ---- linhas do P&L, na ordem do bridge ----
    linhas = sorted(
        {c["linhaPL"] for c in contas if c.get("linhaPL")},
        key=lambda l: (PREFIXOS.get(prefixo_de(l), (9, 1))[0], l),
    )
    desconhecidos = {prefixo_de(l) for l in linhas} - set(PREFIXOS)
    if desconhecidos:
        # Não inventa ordem nem sinal para prefixo que ninguém previu: um sinal
        # errado inverte o número no consolidado sem nada apitar.
        sys.exit(f"Prefixo de P&L não previsto: {sorted(desconhecidos)}. "
                 f"Decida ordem e sinal antes de carregar.")

    print(f"linhas de P&L: {len(linhas)}")
    for i, l in enumerate(linhas, 1):
        n = sum(1 for c in contas if c.get("linhaPL") == l)
        print(f"  {i:>2}. {l}  ({n} conta{'s' if n != 1 else ''})")

    if dry:
        print("\n(dry-run) nada gravado.")
        return

    conn = psycopg2.connect(url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute("SET search_path TO cadastro, public")

            # ---- linha_pl ----
            for i, nome in enumerate(linhas, 1):
                ordem = i * 10          # espaço para inserir linha nova no meio
                sinal = PREFIXOS[prefixo_de(nome)][1]
                cur.execute("""
                    INSERT INTO cadastro.linha_pl (nome, ordem, sinal)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (nome) DO UPDATE
                       SET ordem = EXCLUDED.ordem, sinal = EXCLUDED.sinal
                """, (nome, ordem, sinal))

            cur.execute("SELECT nome, id FROM cadastro.linha_pl")
            id_da_linha = dict(cur.fetchall())

            # ---- conta ----
            registros = []
            for c in contas:
                linha_pl = c.get("linhaPL") or ""
                registros.append((
                    c["conta"],
                    c.get("nome") or "",
                    c.get("categoria"),
                    "R" if prefixo_de(linha_pl) == "Receita" else "D",
                    id_da_linha.get(linha_pl),
                ))

            psycopg2.extras.execute_batch(cur, """
                INSERT INTO cadastro.conta (codigo, descricao, categoria, natureza, linha_pl_id, ativo)
                VALUES (%s, %s, %s, %s, %s, true)
                ON CONFLICT (codigo) DO UPDATE
                   SET descricao   = EXCLUDED.descricao,
                       categoria   = EXCLUDED.categoria,
                       natureza    = EXCLUDED.natureza,
                       linha_pl_id = EXCLUDED.linha_pl_id,
                       ativo       = true
            """, registros, page_size=200)

            # Conta que saiu da origem vira INATIVA, não sumida: lançamento
            # antigo aponta para ela, e apagar quebraria a referência (além de
            # apagar a história de um orçamento já fechado).
            # A conta deixada de fora por conflito NÃO entra aqui: não foi
            # carregada e também não é para ser inativada. Ficar de fora da
            # decisão é diferente de ter saído da origem.
            codigos = [r[0] for r in registros] + list(conflitantes)
            cur.execute("""
                UPDATE cadastro.conta SET ativo = false
                 WHERE ativo AND NOT (codigo = ANY(%s))
             RETURNING codigo
            """, (codigos,))
            inativadas = [r[0] for r in cur.fetchall()]

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pass

    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM cadastro.linha_pl")
        n_linhas = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM cadastro.conta WHERE ativo")
        n_ativas = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM cadastro.conta WHERE linha_pl_id IS NULL")
        n_orfas = cur.fetchone()[0]
    conn.close()

    print(f"\ncarregado: {n_linhas} linhas de P&L, {n_ativas} contas ativas")
    if n_orfas:
        print(f"⚠ {n_orfas} conta(s) sem linha de P&L — não entram no consolidado")
    if inativadas:
        print(f"⚠ {len(inativadas)} conta(s) marcada(s) inativa(s) (sumiram da origem): "
              f"{', '.join(inativadas[:5])}{'…' if len(inativadas) > 5 else ''}")


if __name__ == "__main__":
    main()
