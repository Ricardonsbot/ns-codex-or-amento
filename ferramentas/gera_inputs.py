"""Gera Referencias/inputs.json — as linhas que compõem cada submissão.

Ferramenta de bastidor, como gera_auditoria.py: roda na mão, e o que entra no
repositório é só o JSON.

O ponto central: cada input pertence a uma SUBMISSÃO de aprovacoes.json, e a
soma dos inputs de uma submissão é exatamente o valor dela. Sem isso a tela de
aprovação mostraria um total no cabeçalho e outro na soma das linhas, que é o
tipo de contradição que derruba a confiança numa apresentação.

O status também desce da submissão para as linhas: entrega aprovada não pode
ter linha pendente.
"""
import json
import os
import random

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(RAIZ, "Referencias")
rnd = random.Random(2027)          # semente fixa: roda de novo, dá o mesmo arquivo


def ler(nome):
    with open(os.path.join(REF, nome), encoding="utf-8") as fh:
        return json.load(fh)


contas = ler("contas.json")
aprov = ler("aprovacoes.json")

# Área é o departamento; centro de custo é o código dentro dele. O vocabulário
# vem do que as grades de Despesa já usam (Comercial, TI, Marketing…).
AREAS = {
    "Comercial":      [("COM-001", "Comercial — Geral"), ("COM-002", "Marketing"),
                       ("COM-003", "Vendas")],
    "Tecnologia":     [("TEC-001", "Tecnologia — Geral"), ("TEC-002", "Infraestrutura"),
                       ("TEC-003", "Produto e P&D")],
    "Operações":      [("OPS-001", "Operações — Geral"), ("OPS-002", "Logística"),
                       ("OPS-003", "Atendimento")],
    "Administrativo": [("ADM-001", "Administrativo — Geral"), ("ADM-002", "Facilities")],
    "Pessoas":        [("RH-001", "Pessoas — Geral"), ("RH-002", "Recrutamento")],
    "Financeiro":     [("FIN-001", "Financeiro — Geral"), ("FIN-002", "Controladoria")],
}

JUSTIFICATIVAS = [
    "Reajuste de contrato indexado ao IGP-M, aniversário em março.",
    "Headcount aprovado no comitê de janeiro: duas vagas novas.",
    "Renovação de contrato com reajuste de 8% negociado.",
    "Expansão da operação para a praça de Curitiba.",
    "Aumento de volume previsto no plano comercial.",
    "Migração de fornecedor com custo menor a partir de abril.",
    "Contrato encerrado em dezembro, não renovado.",
    "Absorção da equipe da empresa adquirida.",
    "Projeto de automação reduz custo recorrente no 2º semestre.",
    "Inflação do período aplicada sobre a base atual.",
]

MOTIVOS_REJEICAO = [
    "Acima do teto definido para a área neste ciclo.",
    "Sem justificativa que sustente o salto vs. o ano atual.",
    "Duplicado com a solicitação do CC vizinho.",
    "Reavaliar depois da decisão sobre o projeto de automação.",
]

# Uma submissão de despesa não deveria puxar conta de receita. O filtro é
# grosseiro de propósito: o plano de contas do protótipo tem 36 contas.
def contas_da_categoria(categoria):
    if categoria == "receita":
        pool = [c for c in contas if "Revenue" in c["linhaPL"] or "Receita" in c["linhaPL"]]
    else:
        pool = [c for c in contas if "Despesa" in c["linhaPL"] or "Custo" in c["linhaPL"]]
    return pool or contas


inputs = []
for sub in aprov["submissoes"]:
    area = rnd.choice(list(AREAS))
    pool = contas_da_categoria(sub["categoria"])
    n = rnd.randint(2, 5)

    # reparte o valor da submissão entre as linhas; a última fecha a conta para
    # a soma bater exatamente, sem sobra de arredondamento
    pesos = [rnd.uniform(0.6, 1.6) for _ in range(n)]
    total_peso = sum(pesos)
    valores, acumulado = [], 0.0
    for i, p in enumerate(pesos):
        if i == n - 1:
            valores.append(round(sub["valor"] - acumulado, 1))
        else:
            v = round(sub["valor"] * p / total_peso, 1)
            valores.append(v)
            acumulado += v

    for i, solicitado in enumerate(valores):
        cc_cod, cc_nome = rnd.choice(AREAS[area])
        conta = rnd.choice(pool)

        # valor atual = a base de hoje; o pedido varia de -15% a +45% sobre ela
        fator = rnd.choice([rnd.uniform(0.85, 0.99), rnd.uniform(1.0, 1.12),
                            rnd.uniform(1.12, 1.45)])
        atual = round(solicitado / fator, 1)

        # o status desce da entrega: aprovada não tem linha pendente
        if sub["statusOficial"] == "aprovado":
            status = "aprovado"
        elif sub["statusOficial"] == "reprovado":
            status = "rejeitado"
        elif sub["statusOficial"] == "devolvido":
            status = rnd.choices(["pendente", "rejeitado"], weights=[70, 30])[0]
        else:
            status = rnd.choices(["pendente", "aprovado"], weights=[85, 15])[0]

        item = {
            "id": f"INP-{len(inputs) + 1:04d}",
            "submissaoId": sub["id"],
            "area": area,
            "centroCustoCodigo": cc_cod,
            "centroCusto": cc_nome,
            "conta": conta["conta"],
            "descricao": conta["nome"],
            "categoriaConta": conta["categoria"],
            "linhaPL": conta["linhaPL"],
            "bu": sub["bu"],
            "torre": sub["torre"],
            "empresa": sub["empresa"],
            "categoria": sub["categoria"],
            "responsavel": sub["responsavel"],
            "valorAtual": atual,
            "valorSolicitado": solicitado,
            "status": status,
            "justificativa": rnd.choice(JUSTIFICATIVAS),
        }
        if status == "rejeitado":
            item["motivoRejeicao"] = rnd.choice(MOTIVOS_REJEICAO)
        if status != "pendente":
            item["decididoPor"] = (sub.get("decisao") or {}).get("por", "Emerson Nakamura")
        inputs.append(item)

saida = {
    "ciclo": "2027",
    "cicloRotulo": "Elaboração 2027",
    "baseComparacao": "Budget 2026 vigente",
    "observacao": ("Linhas que compoem cada submissao de aprovacoes.json. A soma dos inputs de "
                   "uma submissao e exatamente o valor dela, e o status desce da entrega para a "
                   "linha. Contas, empresas e responsaveis saem dos mesmos arquivos das outras "
                   "telas. Gerado por ferramentas/gera_inputs.py."),
    "areas": {a: [{"codigo": c, "nome": n} for c, n in ccs] for a, ccs in AREAS.items()},
    "motivosRejeicao": MOTIVOS_REJEICAO,
    "inputs": inputs,
}

with open(os.path.join(REF, "inputs.json"), "w", encoding="utf-8") as fh:
    json.dump(saida, fh, ensure_ascii=False, indent=2)

# conferência: a soma das linhas tem de bater com o valor da submissão
from collections import Counter, defaultdict
por_sub = defaultdict(float)
for x in inputs:
    por_sub[x["submissaoId"]] += x["valorSolicitado"]
divergentes = [s["id"] for s in aprov["submissoes"]
               if abs(por_sub[s["id"]] - s["valor"]) > 0.05]

print(f"{len(inputs)} inputs gravados em Referencias/inputs.json")
print("por status:", dict(Counter(x["status"] for x in inputs)))
print(f"submissoes cobertas: {len(por_sub)} de {len(aprov['submissoes'])}")
print("soma das linhas confere com o valor da submissao:",
      "SIM em todas" if not divergentes else f"NAO em {divergentes}")
