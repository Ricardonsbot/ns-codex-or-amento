"""Gera Referencias/auditoria.json a partir de Referencias/aprovacoes.json.

NAO faz parte do site. O protótipo continua sem build step: as páginas leem só
os JSON prontos de Referencias/. Este script roda na mão, quando aprovacoes.json
mudar e a trilha precisar ser refeita:

    python ferramentas/gera_auditoria.py

Por que gerar em vez de escrever à mão: a trilha precisa concordar com as outras
telas. Cada submissão vira uma linha do tempo com as MESMAS pessoas, datas e
valores que já aparecem em Entregas e Aprovações — se os números divergissem, a
tela de auditoria contradiria a de aprovação na frente da liderança.

A semente do random é fixa: rodar de novo dá exatamente o mesmo arquivo.
"""
import json
import os
import random
from datetime import datetime, timedelta

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REFERENCIAS = os.path.join(RAIZ, "Referencias")

rnd = random.Random(2026)

with open(os.path.join(REFERENCIAS, "aprovacoes.json"), encoding="utf-8") as fh:
    aprov = json.load(fh)
regras = {r["codigo"]: r for r in aprov["regras"]}

MOTIVOS_EDICAO = [
    "Ajuste após conversa com o time da área",
    "Correção de rateio entre centros de custo",
    "Reajuste de contrato aplicado no mês de aniversário",
    "Revisão do headcount previsto",
    "Valor alinhado com o plano comercial",
    "Correção de digitação no mês de referência",
    "Inclusão de item que faltava no pacote",
]
MOTIVOS_EXCLUSAO = [
    "Lançamento duplicado — mantido o registro original",
    "Item migrado para o pacote de Projetos e Iniciativas",
    "Gasto cancelado pela área antes do fechamento",
]

eventos = []


def dt(base, dias=0, hora=9, minuto=0):
    d = datetime.fromisoformat(base[:10]) + timedelta(days=dias)
    return d.replace(hour=hora, minute=minuto).strftime("%Y-%m-%dT%H:%M")


def add(**kw):
    kw["id"] = f"EVT-{len(eventos) + 1:04d}"
    eventos.append(kw)


for sub in aprov["submissoes"]:
    ctx = {"lancamento": sub["id"], "bu": sub["bu"], "torre": sub["torre"],
           "empresa": sub["empresa"], "categoria": sub["categoria"]}
    resp = sub["responsavel"]
    valor_final = sub["valor"]

    # 1. Criação — dias antes do envio, com valor ainda diferente do final
    n_edicoes = rnd.choice([0, 1, 1, 2])
    valor_inicial = valor_final if not n_edicoes else round(valor_final * rnd.uniform(0.82, 1.18), 1)
    dias_antes = rnd.randint(4, 11)
    add(**ctx, quando=dt(sub["enviadoEm"], -dias_antes, rnd.randint(8, 17), rnd.choice([0, 15, 30, 45])),
        quem=resp, papel="Responsável pela entrega", acao="criou",
        campo="valor", de=None, para=valor_inicial,
        observacao="Primeiro lançamento da linha no ciclo")

    # 2. Edições — é aqui que o "editou" do roadmap vira algo visível
    valor_corrente = valor_inicial
    for i in range(n_edicoes):
        alvo = valor_final if i == n_edicoes - 1 else round(valor_corrente * rnd.uniform(0.9, 1.1), 1)
        add(**ctx, quando=dt(sub["enviadoEm"], -dias_antes + 1 + i * rnd.randint(1, 3),
                             rnd.randint(8, 18), rnd.choice([0, 10, 20, 40])),
            quem=resp, papel="Responsável pela entrega", acao="editou",
            campo="valor", de=valor_corrente, para=alvo,
            observacao=rnd.choice(MOTIVOS_EDICAO))
        valor_corrente = alvo

    # 3. Envio para aprovação
    add(**ctx, quando=dt(sub["enviadoEm"], 0, rnd.randint(9, 19), rnd.choice([0, 5, 25, 50])),
        quem=resp, papel="Responsável pela entrega", acao="enviou",
        campo="valor", de=None, para=valor_final,
        observacao="Entrega submetida ao aprovador")

    # 4. Validação automática — reflete as validacoes que já estão no aprovacoes.json
    falhas = [v for v in sub["validacoes"] if v["resultado"] != "ok"]
    bloqueios = [v for v in falhas if regras.get(v["regra"], {}).get("severidade") == "bloqueia"]
    if falhas:
        nomes = ", ".join(regras.get(v["regra"], {}).get("nome", v["regra"]) for v in falhas)
        obs = f"{'Travou' if bloqueios else 'Alertou'}: {nomes}"
    else:
        obs = "Passou nas 6 regras de consistência"
    add(**ctx, quando=dt(sub["enviadoEm"], 0, rnd.randint(20, 23), rnd.choice([1, 12, 33])),
        quem="Sistema", papel="Validação automática", acao="validou",
        campo=None, de=None, para=None, observacao=obs)

    # 5. Decisão do aprovador
    dec = sub.get("decisao") or {}
    if dec.get("em"):
        acao = {"aprovado": "aprovou", "reprovado": "reprovou",
                "devolvido": "devolveu"}.get(sub["statusOficial"], "decidiu")
        add(**ctx, quando=dt(dec["em"], 0, rnd.randint(9, 18), rnd.choice([0, 15, 40])),
            quem=dec.get("por", "Emerson Nakamura"), papel="Aprovador", acao=acao,
            campo="statusOficial", de="pendente", para=sub["statusOficial"],
            observacao=dec.get("parecer", ""))

    # 6. Aceite final do líder — o mesmo registro que Aprovações já mostra
    ace = sub.get("aceiteFinal")
    if ace:
        add(**ctx, quando=ace["em"], quem=ace["por"], papel=ace.get("cargo", "Líder"),
            acao="aceitou", campo="aceiteFinal", de=None, para="assumido",
            observacao=ace.get("observacao", ""))

# 7. Linhas criadas e excluídas antes do envio.
#
# Têm id próprio (DEL-xxx) e NÃO existem em aprovacoes.json de propósito: aquele
# arquivo só guarda o que o responsável chegou a enviar. Enxertar a exclusão numa
# submissão existente produzia um absurdo — lançamento excluído que depois
# aparecia aprovado e assumido por um líder.
for n, sub in enumerate(rnd.sample(aprov["submissoes"], 6), 1):
    ctx = {"lancamento": f"DEL-{n:03d}", "bu": sub["bu"], "torre": sub["torre"],
           "empresa": sub["empresa"], "categoria": sub["categoria"]}
    resp = sub["responsavel"]
    valor = round(sub["valor"] * rnd.uniform(0.1, 0.4), 1)
    nascimento = rnd.randint(6, 12)

    add(**ctx, quando=dt(sub["enviadoEm"], -nascimento, rnd.randint(8, 16), rnd.choice([0, 20, 40])),
        quem=resp, papel="Responsável pela entrega", acao="criou",
        campo="valor", de=None, para=valor,
        observacao="Primeiro lançamento da linha no ciclo")

    if rnd.random() < 0.5:
        novo = round(valor * rnd.uniform(0.85, 1.15), 1)
        add(**ctx, quando=dt(sub["enviadoEm"], -nascimento + rnd.randint(1, 2), rnd.randint(9, 17), 15),
            quem=resp, papel="Responsável pela entrega", acao="editou",
            campo="valor", de=valor, para=novo, observacao=rnd.choice(MOTIVOS_EDICAO))
        valor = novo

    # exclusão é terminal: nada acontece com a linha depois disto
    add(**ctx, quando=dt(sub["enviadoEm"], -rnd.randint(1, 3), rnd.randint(8, 17), 30),
        quem=resp, papel="Responsável pela entrega", acao="excluiu",
        campo="valor", de=valor, para=None,
        observacao=rnd.choice(MOTIVOS_EXCLUSAO))

eventos.sort(key=lambda e: e["quando"])
for i, e in enumerate(eventos, 1):
    e["id"] = f"EVT-{i:04d}"

saida = {
    "ciclo": aprov["ciclo"],
    "observacao": ("Trilha derivada de aprovacoes.json: as pessoas, datas e valores sao os mesmos "
                   "que aparecem em Entregas e Aprovacoes. O prototipo nao tem backend, entao os "
                   "eventos sao ilustrativos - o que a tela demonstra e o formato do registro. "
                   "Gerado por ferramentas/gera_auditoria.py."),
    "acoes": {
        "criou":    {"rotulo": "Criou",    "cor": "criou"},
        "editou":   {"rotulo": "Editou",   "cor": "editou"},
        "excluiu":  {"rotulo": "Excluiu",  "cor": "excluiu"},
        "enviou":   {"rotulo": "Enviou",   "cor": "enviou"},
        "validou":  {"rotulo": "Validou",  "cor": "validou"},
        "aprovou":  {"rotulo": "Aprovou",  "cor": "aprovou"},
        "reprovou": {"rotulo": "Reprovou", "cor": "reprovou"},
        "devolveu": {"rotulo": "Devolveu", "cor": "devolveu"},
        "aceitou":  {"rotulo": "Assumiu",  "cor": "aceitou"},
    },
    "eventos": eventos,
}

destino = os.path.join(REFERENCIAS, "auditoria.json")
with open(destino, "w", encoding="utf-8") as fh:
    json.dump(saida, fh, ensure_ascii=False, indent=2)

print(f"{len(eventos)} eventos gravados em Referencias/auditoria.json")
