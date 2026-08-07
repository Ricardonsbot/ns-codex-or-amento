"""Gera Referencias/inputs.json — os inputs orçamentários do ciclo seguinte.

Ferramenta de bastidor, como gera_auditoria.py: roda na mão, e o que entra no
repositório é só o JSON. O protótipo continua sem build step.

As contas, empresas, torres e responsáveis saem dos arquivos que já existem,
para a tela de aprovação não contradizer Entregas, Aprovações e os relatórios.
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
org = [o for o in ler("organizacional.json") if o["torre"] != "-"]
aprov = ler("aprovacoes.json")
pessoas = sorted({s["responsavel"] for s in aprov["submissoes"]})

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
    "Renovação do contrato com reajuste de 8% negociado.",
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

inputs = []
for i in range(140):
    area = rnd.choice(list(AREAS))
    cc_cod, cc_nome = rnd.choice(AREAS[area])
    conta = rnd.choice(contas)
    o = rnd.choice(org)

    # valor atual = base do ano corrente; solicitado varia de -15% a +45%
    atual = round(rnd.uniform(80, 4200), 1)
    fator = rnd.choice([rnd.uniform(0.85, 0.99), rnd.uniform(1.0, 1.12),
                        rnd.uniform(1.12, 1.45)])
    solicitado = round(atual * fator, 1)

    # a maioria fica pendente: a tela existe para dar conta dessa fila
    status = rnd.choices(["pendente", "aprovado", "rejeitado"], weights=[62, 30, 8])[0]

    item = {
        "id": f"INP-{i + 1:04d}",
        "area": area,
        "centroCustoCodigo": cc_cod,
        "centroCusto": cc_nome,
        "conta": conta["conta"],
        "descricao": conta["nome"],
        "categoria": conta["categoria"],
        "linhaPL": conta["linhaPL"],
        "bu": o["bu"],
        "torre": o["torre"],
        "empresa": o["empresa"],
        "responsavel": rnd.choice(pessoas),
        "valorAtual": atual,
        "valorSolicitado": solicitado,
        "status": status,
        "justificativa": rnd.choice(JUSTIFICATIVAS),
        "solicitadoEm": f"2026-07-{rnd.randint(1, 28):02d}",
    }
    if status == "rejeitado":
        item["motivoRejeicao"] = rnd.choice(MOTIVOS_REJEICAO)
    if status in ("aprovado", "rejeitado"):
        item["decididoPor"] = "Emerson Nakamura"
        item["decididoEm"] = f"2026-08-{rnd.randint(1, 5):02d}"
    inputs.append(item)

inputs.sort(key=lambda x: (x["area"], x["centroCusto"], x["conta"]))
for i, x in enumerate(inputs, 1):
    x["id"] = f"INP-{i:04d}"

saida = {
    "ciclo": "2027",
    "cicloRotulo": "Elaboração 2027",
    "baseComparacao": "Budget 2026 vigente",
    "observacao": ("Inputs orcamentarios do ciclo de elaboracao seguinte. Contas, empresas, "
                   "torres e responsaveis saem de contas.json, organizacional.json e "
                   "aprovacoes.json, para a tela nao contradizer as demais. Valores e status "
                   "sao ilustrativos do prototipo. Gerado por ferramentas/gera_inputs.py."),
    "areas": {a: [{"codigo": c, "nome": n} for c, n in ccs] for a, ccs in AREAS.items()},
    "motivosRejeicao": MOTIVOS_REJEICAO,
    "inputs": inputs,
}

with open(os.path.join(REF, "inputs.json"), "w", encoding="utf-8") as fh:
    json.dump(saida, fh, ensure_ascii=False, indent=2)

from collections import Counter
c = Counter(x["status"] for x in inputs)
tot = lambda f: round(sum(x["valorSolicitado"] for x in inputs if f(x)), 1)
print(f"{len(inputs)} inputs gravados em Referencias/inputs.json")
print("por status:", dict(c))
print(f"solicitado total: R$ {tot(lambda x: True):,.1f} mil".replace(",", "."))
print(f"areas: {len(AREAS)} · centros de custo: {sum(len(v) for v in AREAS.values())}"
      f" · categorias: {len({x['categoria'] for x in inputs})}")
