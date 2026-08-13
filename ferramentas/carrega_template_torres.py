"""Carrega o cadastro do Template Budget das Torres (BU Embarcador + Corporate).

Ferramenta de bastidor, como as outras: roda na mão. Demora ~2 min, porque o
arquivo é .xlsb (Excel binário) e o leitor é lento.

Fonte: Referencias/template-budget-torres.xlsb

POR QUE ESTE TEMPLATE IMPORTA MAIS QUE O DO PSL

O do PSL trazia os lançamentos. Este traz o CADASTRO, e resolve três coisas que
estavam pendentes:

1. PACOTE E LINHA DO P&L SÃO COLUNAS DIFERENTES. Em tbl_KMM_Contas as duas
   vinham no mesmo campo (FPA_Pacote), e por isso a plataforma tratava pacote
   como se fosse linha de resultado. Aqui a conta tem Pacote, Subpacote, linha
   do P&L e classificação de caixa, cada uma na sua coluna.

2. PRODUTO TEM DOIS NÍVEIS. "Produto Sintético" é o produto; "Produto
   Analítico" é o sub-produto. Era o campo que a plataforma pedia e nenhuma
   fonte preenchia.

3. CENTRO DE CUSTO COBRE A EMPRESA INTEIRA. São 105 centros com diretoria e
   grupo, contra os 171 de antes que só existiam para IM e Nstech.

O QUE ESTE SCRIPT NÃO FAZ

Não mexe na hierarquia BU -> Torre -> Empresa. Este template nomeia as torres
de um jeito ("TMS", "Torre Buonny") e deparaempresas.xlsx de outro ("Torre ICP
Médio e Grande", "Buonny"). O de/para oficial continua sendo o outro arquivo;
aqui só se traduz o nome para casar o produto com a torre certa.

Também não toca em pacotes.json. O pacote de lá é o MOTIVO do gasto (Operação
Base, Novos Contratos), conceito da plataforma que nenhum template tem. O
pacote deste arquivo é o agrupamento de FP&A e vira campo da conta.
"""
import io
import json
import os
import re
from collections import OrderedDict

from pyxlsb import open_workbook

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(RAIZ, "Referencias")
TEMPLATE = os.path.join(REF, "template-budget-torres.xlsb")

# As torres deste template x as do cadastro (deparaempresas.xlsx manda)
TORRE_DEPARA = {
    "Torre Pequeno e Micro": "Torre ICP Pequeno e Micro",
    "Torre Médio e Grande": "Torre ICP Médio e Grande",
    "Torre Buonny": "Buonny",
    "Torre Embarcador 2.0": "Torre SW Embarcador",
    "Midia": "Mídia",
    "TMS": "Torre ICP Médio e Grande",
}


def limpo(v):
    if v is None:
        return ""
    if isinstance(v, float) and v == int(v):
        v = int(v)
    return re.sub(r"\s+", " ", str(v).replace("\xa0", " ")).strip()


def torre(nome):
    n = limpo(nome)
    return TORRE_DEPARA.get(n, n)


def pontuar(codigo):
    """4703001012 -> 4.7.03.001.012, o formato que o resto do cadastro usa."""
    d = re.sub(r"\D", "", codigo)
    return re.sub(r"^(\d)(\d)(\d\d)(\d\d\d)(\d\d\d)$", r"\1.\2.\3.\4.\5", d) if len(d) == 10 else codigo


def gravar(nome, conteudo):
    with io.open(os.path.join(REF, nome), "w", encoding="utf-8", newline="") as fh:
        json.dump(conteudo, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def ler_abas(nomes):
    dados = {}
    with open_workbook(TEMPLATE) as wb:
        for aba in nomes:
            linhas = []
            with wb.get_sheet(aba) as ws:
                for linha in ws.rows():
                    v = [limpo(c.v) for c in linha]
                    while v and not v[-1]:
                        v.pop()
                    if v:
                        linhas.append(v)
            dados[aba] = linhas
    return dados


def col(linha, i):
    return linha[i] if i < len(linha) else ""


# ---------------------------------------------------------------- contas

def enriquecer_contas(plano):
    """Acrescenta Pacote, Subpacote, linha detalhada e caixa às contas que já
    existem, e traz as que faltavam. O campo linhaPL NÃO muda: é o prefixo dele
    (Receita > / Despesas > / Capex >) que separa as categorias nas telas."""
    caminho = os.path.join(REF, "contas.json")
    contas = json.load(io.open(caminho, encoding="utf-8"))
    porCodigo = {c["conta"].replace(".", ""): c for c in contas}

    enriquecidas = novas = 0
    for l in plano[4:]:
        codigo = col(l, 2)
        if not codigo or not codigo.isdigit():
            continue
        extra = {
            "pacote": col(l, 5),
            "subpacote": col(l, 6),
            "caixa": col(l, 7),
            "linhaPLDetalhe": col(l, 8),
        }
        alvo = porCodigo.get(codigo)
        if alvo:
            alvo.update({k: v for k, v in extra.items() if v})
            enriquecidas += 1
        else:
            pacote = extra["pacote"]
            prefixo = "Capex" if pacote == "Capex" else "Despesas"
            contas.append({
                "conta": pontuar(codigo), "nome": col(l, 4),
                "linhaPL": f"{prefixo} > {pacote}" if pacote else "",
                "categoria": extra["subpacote"] or pacote, **extra,
            })
            novas += 1

    contas.sort(key=lambda c: c["conta"])
    gravar("contas.json", contas)
    com = sum(1 for c in contas if c.get("pacote"))
    print(f"contas.json          {len(contas):5d} contas | {enriquecidas} enriquecidas, "
          f"{novas} novas | {com} com pacote")
    return contas


def catalogo_pacotes(contas):
    """O pacote de FP&A, com os subpacotes que aparecem em cada um."""
    arvore = OrderedDict()
    for c in sorted(contas, key=lambda x: (x.get("pacote", ""), x.get("subpacote", ""))):
        p = c.get("pacote")
        if not p:
            continue
        arvore.setdefault(p, {"nome": p, "subpacotes": [], "contas": 0})
        arvore[p]["contas"] += 1
        sub = c.get("subpacote")
        if sub and sub not in arvore[p]["subpacotes"]:
            arvore[p]["subpacotes"].append(sub)

    gravar("pacotes-fpa.json", {
        "observacao": (
            "Pacote e subpacote de FP&A, do Template Budget das Torres (aba Plano de "
            "Contas). Sao atributo da CONTA, nao escolha de quem lanca: a grade preenche "
            "sozinha, como faz com a linha do P&L. Nao confundir com pacotes.json, que "
            "guarda o MOTIVO do gasto (Operacao Base, Novos Contratos) — conceito da "
            "plataforma, que nenhum template tem. "
            "Gerado por ferramentas/carrega_template_torres.py."),
        "pacotes": list(arvore.values()),
    })
    print(f"pacotes-fpa.json     {len(arvore):5d} pacotes | "
          f"{sum(len(p['subpacotes']) for p in arvore.values())} subpacotes")


# -------------------------------------------------------------- produtos

def carregar_produtos(lista):
    """Produto Sintético vira o produto; Produto Analítico, o sub-produto."""
    atual = json.load(io.open(os.path.join(REF, "produtos.json"), encoding="utf-8"))

    porNome = OrderedDict()
    for l in lista[3:]:
        bu, tr, sintetico, analitico = col(l, 2), torre(col(l, 3)), col(l, 4), col(l, 5)
        if not sintetico:
            continue
        p = porNome.setdefault(sintetico, {"nome": sintetico, "torres": [], "subProdutos": []})
        if tr and tr not in p["torres"]:
            p["torres"].append(tr)
        # sub-produto igual ao produto não é divisão, é a linha única dele
        if analitico and analitico != sintetico and analitico not in p["subProdutos"]:
            p["subProdutos"].append(analitico)

    # o catálogo antigo veio de deparaempresas.xlsx (base de recebimento); o que
    # ele tem e este não, continua valendo — são torres que este arquivo não cobre
    novos = {p["nome"] for p in porNome.values()}
    herdados = [p for p in atual["produtos"] if p["nome"] not in novos]

    gravar("produtos.json", {
        "observacao": (
            "Catalogo de produto da Receita. Produto e sub-produto vem do Template Budget "
            "das Torres (aba Lista Produtos), onde Produto Sintetico e o produto e Produto "
            "Analitico e a divisao dele — era o sub-produto que nenhuma fonte preenchia. "
            "Os produtos sem nivel analitico vieram de deparaempresas.xlsx e cobrem as "
            "torres que este template nao alcanca. "
            "Gerado por ferramentas/carrega_template_torres.py."),
        "produtos": list(porNome.values()) + herdados,
    })
    comSub = sum(1 for p in porNome.values() if p["subProdutos"])
    print(f"produtos.json        {len(porNome) + len(herdados):5d} produtos | "
          f"{comSub} com sub-produto | {len(herdados)} herdados do de/para")


# ------------------------------------------------------------- centros

def carregar_centros(plano):
    centros, vistos = [], set()
    for l in plano[1:]:
        codigo, descricao = col(l, 4), col(l, 5)
        if not codigo or codigo in vistos or codigo.lower() in ("centro de custo", ""):
            continue
        vistos.add(codigo)
        centros.append({"codigo": codigo, "nome": descricao,
                        "diretoria": col(l, 2), "grupo": col(l, 3)})

    diretorias = sorted({c["diretoria"] for c in centros if c["diretoria"]})
    gravar("centros-custo.json", {
        "observacao": (
            "Centros de custo do Template Budget das Torres (aba Plano de Centros), com a "
            "diretoria e o grupo de cada um. Substitui a lista anterior, que saia de "
            "tbl_KMM_Organizacional e so existia para IM e Nstech. "
            "Gerado por ferramentas/carrega_template_torres.py."),
        "diretorias": diretorias,
        "centros": centros,
    })
    print(f"centros-custo.json   {len(centros):5d} centros | {len(diretorias)} diretorias")


# ------------------------------------------------------------ dimensões

def carregar_dimensoes(parametros, clientes):
    atual = json.load(io.open(os.path.join(REF, "dimensoes-receita.json"), encoding="utf-8"))
    coluna = lambda linhas, i, ini=1: [c for c in (col(l, i) for l in linhas[ini:]) if c]

    movimento = coluna(parametros, 1)
    natureza = coluna(parametros, 3)
    classes = coluna(parametros, 8)
    personas = coluna(clientes, 2)
    setores = coluna(clientes, 5)

    atual.update({
        "observacao": (
            "Eixos de classificacao da receita. Tipo Receita (movimento) e Categoria "
            "(natureza) vem da aba Parametros Receitas do Template Budget das Torres; "
            "persona e setor, da aba Parametros Clientes. MOVIMENTO responde de onde vem o "
            "numero (base, venda nova, churn); NATUREZA responde o que foi vendido. "
            "Gerado por ferramentas/carrega_template_torres.py."),
        "movimento": movimento or atual["movimento"],
        "natureza": natureza or atual["natureza"],
        "classesCliente": classes or atual["classesCliente"],
        "personas": personas or atual["personas"],
        "setores": setores or atual["setores"],
    })
    gravar("dimensoes-receita.json", atual)
    print(f"dimensoes-receita    movimento={len(atual['movimento'])} natureza={len(atual['natureza'])} "
          f"classes={len(atual['classesCliente'])} personas={len(atual['personas'])}")


if __name__ == "__main__":
    print("lendo o .xlsb (leva ~2 min)...")
    d = ler_abas(["Plano de Contas", "Plano de Centros", "Lista Produtos",
                  "Parâmetros Receitas", "Parâmetros Clientes"])
    print()
    contas = enriquecer_contas(d["Plano de Contas"])
    catalogo_pacotes(contas)
    carregar_produtos(d["Lista Produtos"])
    carregar_centros(d["Plano de Centros"])
    carregar_dimensoes(d["Parâmetros Receitas"], d["Parâmetros Clientes"])
    print("\nagora rode: python ferramentas/gera_dados_embutidos.py")
