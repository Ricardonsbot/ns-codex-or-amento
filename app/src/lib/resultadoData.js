import { supabase } from './supabaseClient'
import {
  classificar,
  demonstrativo,
  acumular,
  zeros,
  somar,
  CHAVES_EXPENSES,
} from './demonstrativo'

/**
 * Os dados do Resultado: busca os lançamentos de uma versão e soma nas
 * dimensões que os quadros usam. Nenhuma linha de P&L é calculada aqui — isso
 * mora em demonstrativo.js, num lugar só. Aqui cada lançamento vira uma chave
 * base (classificar) e é somado no consolidado, em cada empresa e em cada nó
 * da estrutura BU → Torre → Sub Torre → Empresa.
 *
 * Nada calcula dedução nem reajuste: soma o que está gravado.
 */

/**
 * Agrupa itens por BU → Torre → Sub Torre → Empresa.
 *
 * Recebe uma forma neutra — { tipo, bu, torre, sub, empresa, meses } — em vez
 * de linha do banco, porque a conferência da importação precisa do mesmo painel
 * antes de gravar, quando os dados só existem em memória.
 */
export function agruparPorEstrutura(itens) {
  const mapa = new Map()
  for (const it of itens) {
    const caminho = [
      [it.bu?.id, it.bu?.nome ?? 'Sem BU'],
      [it.torre?.id, it.torre?.nome ?? 'Sem Torre'],
      [it.sub?.id, it.sub?.nome ?? 'Sem Sub Torre'],
      [it.empresa?.id, it.empresa?.nome ?? 'Sem Empresa'],
    ]
    let prefixo = ''
    for (let nivel = 0; nivel < caminho.length; nivel++) {
      const [id, nome] = caminho[nivel]
      prefixo += `${id ?? 'x'}|`
      if (!mapa.has(prefixo)) {
        mapa.set(prefixo, { nivel, nome, receita: zeros(), despesa: zeros(), capex: zeros(), base: new Map() })
      }
      const no = mapa.get(prefixo)
      no[it.tipo] = somar(no[it.tipo], it.meses)
      // A chave base do demonstrativo, quando o item tem: é dela que saem as
      // colunas dos painéis por estrutura, com as mesmas fórmulas do P&L.
      if (it.chave) acumular(no.base, it.chave, it.meses)
    }
  }
  return { estrutura: [...mapa.entries()].map(([chave, no]) => ({ chave, ...no })), arvore: montarArvore(mapa) }
}

/**
 * O PostgREST recusa a consulta inteira quando um dos campos do select não
 * existe, então a coluna de subpacote é sondada uma vez por sessão. Enquanto a
 * migração 2026-09-10 não rodar, a visão de pacote fica sem a abertura e o
 * resto da tela segue igual.
 */
let temSubpacote = null
async function sondarSubpacote() {
  if (temSubpacote !== null) return temSubpacote
  const { error } = await supabase
    .from('lancamento')
    .select('pacote, subpacote, linha_pl_template, area_ajustada')
    .limit(1)
  temSubpacote = !error
  return temSubpacote
}

/** As colunas de produto e cliente existem? Vieram na migração 2026-09-10. */
let temProduto = null
async function sondarProduto() {
  if (temProduto !== null) return temProduto
  const { error } = await supabase.from('lancamento').select('produto_analitico, produto_sintetico, cliente').limit(1)
  temProduto = !error
  return temProduto
}

/**
 * A coluna do reajuste mensal existe? É ela que separa o efeito de preço
 * contratual do resto na Bridge de Receita. Sem ela a bridge por driver
 * segue funcionando — o reajuste some como degrau e fica dentro de
 * expansão e contração.
 */
let temReajuste = null
async function sondarReajuste() {
  if (temReajuste !== null) return temReajuste
  const { error } = await supabase.from('lancamento_valor_mensal').select('valor_reajuste').limit(1)
  temReajuste = !error
  return temReajuste
}

/**
 * O gasto é Labor? Quem diz é a coluna Linha P&L da Base Gastos:
 * "Operational Payments - Labor" contra "Operational payments - non Labor" no
 * template 2027. No de 2026 a mesma coluna trazia a natureza, e o que era
 * pessoal vinha como "Employee" — continua valendo para os dados antigos.
 */
export function ehLabor(linhaPlTemplate) {
  const t = String(linhaPlTemplate ?? '').toLowerCase()
  if (/non[\s-]*labor/.test(t)) return false
  return /labor/.test(t) || t === 'employee'
}

export async function fetchResultado(versaoId, { buId, torreId, empresaId } = {}) {
  const [comSubpacote, comProduto, comReajuste] = await Promise.all([
    sondarSubpacote(),
    sondarProduto(),
    sondarReajuste(),
  ])
  const campos =
    'tipo, area, bu_id, bu:bu_id(nome), torre_id, torre:torre_id(nome), sub_torre_id, ' +
    'sub_torre:sub_torre_id(nome), empresa_id, empresa:empresa_id(nome), ' +
    `conta:conta_id(codigo, nome, linha_pl), lancamento_valor_mensal(mes, valor${comReajuste ? ', valor_reajuste' : ''})` +
    (comSubpacote ? ', pacote, subpacote, linha_pl_template, area_ajustada' : '') +
    (comProduto ? ', produto_analitico, produto_sintetico, cliente' : '')

  // O cadastro inteiro do recorte: toda empresa aparece, com ou sem
  // lançamento, e zero só quando ela não lançou nada.
  let cadastroQ = supabase
    .from('empresa')
    .select('id, nome, bu_id, torre_id, sub_torre_id, bu:bu_id(nome), torre:torre_id(nome), sub_torre:sub_torre_id(nome)')
  if (buId) cadastroQ = cadastroQ.eq('bu_id', buId)
  if (torreId) cadastroQ = cadastroQ.eq('torre_id', torreId)
  if (empresaId) cadastroQ = cadastroQ.eq('id', empresaId)

  const linhas = []
  for (let de = 0; ; de += 1000) {
    let q = supabase.from('lancamento').select(campos).eq('versao_id', versaoId)
    if (buId) q = q.eq('bu_id', buId)
    if (torreId) q = q.eq('torre_id', torreId)
    if (empresaId) q = q.eq('empresa_id', empresaId)
    const { data, error } = await q.range(de, de + 999)
    if (error) throw error
    linhas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const { data: cadastro, error: erroCadastro } = await cadastroQ
  if (erroCadastro) throw erroCadastro

  const novaEmpresa = (id, nome) => ({ id, nome, base: new Map(), temLancamento: false })
  const porEmpresa = new Map((cadastro ?? []).map((e) => [e.id, novaEmpresa(e.id, e.nome)]))
  const base = new Map() // chave do demonstrativo -> 12 meses
  const baseLabor = new Map() // a parte Labor de cada chave de Expenses
  const porPacote = new Map() // pacote -> { total, subs: Map(subpacote -> meses) }
  const porProduto = new Map() // produto -> 12 meses de Net Revenue
  // cliente × produto -> { valores, reajuste }: o grão da bridge por driver.
  const porClienteProduto = new Map()
  let semConta = zeros()
  const itens = []

  for (const l of linhas) {
    const meses = zeros()
    const reajuste = zeros()
    for (const v of l.lancamento_valor_mensal ?? []) {
      meses[v.mes - 1] += Number(v.valor)
      reajuste[v.mes - 1] += Number(v.valor_reajuste ?? 0)
    }

    const k = classificar(l)
    if (k) acumular(base, k, meses)
    else semConta = somar(semConta, meses)
    if (k && CHAVES_EXPENSES.includes(k) && ehLabor(l.linha_pl_template)) acumular(baseLabor, k, meses)

    // O quadro de pacotes vem da coluna Pacote do template, não do plano de
    // contas: inclui o que ainda não tem conta cadastrada. Cada pacote guarda
    // também o gasto por área (G&A, CoGS, R&D...), que é o filtro do quadro.
    if (l.tipo !== 'receita' && l.pacote) {
      if (!porPacote.has(l.pacote)) porPacote.set(l.pacote, { total: zeros(), areas: new Map(), subs: new Map() })
      const g = porPacote.get(l.pacote)
      const area = l.area_ajustada || l.area || 'Sem área'
      g.total = somar(g.total, meses)
      acumular(g.areas, area, meses)
      const sub = l.subpacote || 'Sem subpacote'
      if (!g.subs.has(sub)) g.subs.set(sub, { total: zeros(), areas: new Map() })
      const s = g.subs.get(sub)
      s.total = somar(s.total, meses)
      acumular(s.areas, area, meses)
    }

    // Receita por produto: é a base da Bridge de Receita. Entra o que vira
    // Net Revenue — Gross Revenue e dedução —, com o nome analítico quando
    // existe; o sintético serve de reserva.
    if (l.tipo === 'receita' && (k === 'gr' || k === 'ded')) {
      const produto = l.produto_analitico || l.produto_sintetico || 'Sem produto'
      const cliente = l.cliente || 'Sem cliente'
      acumular(porProduto, produto, meses)
      const chave = `${cliente}||${produto}`
      if (!porClienteProduto.has(chave)) {
        porClienteProduto.set(chave, { chave, cliente, produto, valores: zeros(), reajuste: zeros() })
      }
      const cp = porClienteProduto.get(chave)
      cp.valores = somar(cp.valores, meses)
      cp.reajuste = somar(cp.reajuste, reajuste)
    }

    const eid = l.empresa_id ?? 'sem-empresa'
    if (!porEmpresa.has(eid)) porEmpresa.set(eid, novaEmpresa(l.empresa_id, l.empresa?.nome ?? 'Sem Empresa'))
    const e = porEmpresa.get(eid)
    e.temLancamento = true
    if (k) acumular(e.base, k, meses)

    itens.push({
      tipo: l.tipo,
      chave: k,
      meses,
      bu: { id: l.bu_id, nome: l.bu?.nome },
      torre: { id: l.torre_id, nome: l.torre?.nome },
      sub: { id: l.sub_torre_id, nome: l.sub_torre?.nome },
      empresa: { id: l.empresa_id, nome: l.empresa?.nome },
    })
  }

  // As empresas do cadastro entram zeradas, antes dos lançamentos: somar zero
  // não muda nada, e a chave do caminho é a mesma que o lançamento gera.
  const vazias = (cadastro ?? []).map((e) => ({
    tipo: 'receita',
    meses: zeros(),
    bu: { id: e.bu_id, nome: e.bu?.nome },
    torre: { id: e.torre_id, nome: e.torre?.nome },
    sub: { id: e.sub_torre_id, nome: e.sub_torre?.nome },
    empresa: { id: e.id, nome: e.nome },
  }))
  const agrupado = agruparPorEstrutura([...vazias, ...itens])

  const doMapa = (m) => (c) => m.get(c)

  return {
    base,
    demo: demonstrativo(doMapa(base)),
    // Labor do "(-) Expenses": a soma do que é Labor nas chaves dele.
    laborExpenses: CHAVES_EXPENSES.reduce((a, c) => somar(a, baseLabor.get(c) ?? zeros()), zeros()),
    semConta,
    foraDaMaster: [...base.entries()]
      .filter(([c]) => c.startsWith('fora:'))
      .map(([c, valores]) => ({ chave: c.slice(5), valores })),
    empresas: [...porEmpresa.values()]
      .map((e) => ({ ...e, demo: demonstrativo(doMapa(e.base)) }))
      .sort((a, b) => soma(b.demo.nr) - soma(a.demo.nr) || a.nome.localeCompare(b.nome)),
    pacotes: [...porPacote.entries()]
      .map(([nome, g]) => ({
        nome,
        valores: g.total,
        areas: Object.fromEntries(g.areas),
        subpacotes: [...g.subs.entries()]
          .map(([sub, s]) => ({ nome: sub, valores: s.total, areas: Object.fromEntries(s.areas) }))
          .sort((a, b) => soma(b.valores) - soma(a.valores)),
      }))
      .sort((a, b) => soma(b.valores) - soma(a.valores)),
    // As áreas que aparecem nos pacotes, da maior para a menor: são as opções
    // do filtro do quadro "Gastos por pacote".
    areasDosPacotes: [
      ...[...porPacote.values()]
        .reduce((mapa, g) => {
          for (const [area, v] of g.areas) mapa.set(area, (mapa.get(area) ?? 0) + soma(v))
          return mapa
        }, new Map())
        .entries(),
    ]
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .map(([nome]) => nome),
    produtos: [...porProduto.entries()]
      .map(([nome, valores]) => ({ nome, valores }))
      .sort((a, b) => soma(b.valores) - soma(a.valores)),
    clienteProduto: [...porClienteProduto.values()],
    comReajuste,
    // A chave do caminho casa o mesmo nó entre versões (Budget e Last Year).
    estrutura: agrupado.estrutura,
    arvore: agrupado.arvore,
    lancamentos: linhas.length,
  }
}

const soma = (v) => v.reduce((a, b) => a + b, 0)

/**
 * Aninha os nós pela chave do caminho ("bu|torre|sub|empresa|"): o pai de um nó
 * é o mesmo caminho sem o último trecho. A lista plana vinha na ordem em que os
 * lançamentos apareceram, que não é a ordem de leitura do painel.
 */
function montarArvore(mapa) {
  const nos = [...mapa.entries()].map(([chave, no]) => ({ chave, ...no, filhos: [] }))
  const porChave = new Map(nos.map((n) => [n.chave, n]))
  const raiz = []
  for (const n of nos) {
    const partes = n.chave.split('|').filter(Boolean)
    const pai = partes.length > 1 ? porChave.get(partes.slice(0, -1).join('|') + '|') : null
    if (pai) pai.filhos.push(n)
    else raiz.push(n)
  }
  const ordenar = (lista) => {
    lista.sort((a, b) => soma(b.receita) - soma(a.receita) || a.nome.localeCompare(b.nome))
    for (const n of lista) ordenar(n.filhos)
  }
  ordenar(raiz)
  return raiz
}

/**
 * Semáforo do painel. O corte é uma escolha, não uma regra contábil: acima do
 * comparativo é verde, até 5% abaixo é amarelo, abaixo disso é vermelho. Se o
 * FP&A usar outro corte, é aqui que muda.
 */
export function semaforo(pct) {
  if (pct === null || !isFinite(pct)) return null
  // Os cortes sao os mesmos do icone do Master Resultado: verde acima de +3%,
  // vermelho abaixo de -3%, amarelo no meio.
  if (pct >= 3) return 'verde'
  if (pct >= -3) return 'amarelo'
  return 'vermelho'
}

/**
 * Os ciclos (anos) com as suas versões, do mais recente ao mais antigo. É o
 * que o Resultado usa para escolher o ano e achar o Last Year: o budget do
 * ano anterior é o ciclo `ano − 1`, se ele tiver sido carregado.
 */
export async function fetchCiclosResultado() {
  const { data, error } = await supabase
    .from('ciclo')
    .select('id, ano, status, versao(id, nome, tipo, status, criada_em)')
    .order('ano', { ascending: false })
  if (error) throw error
  return data ?? []
}

export { versaoReferencia } from './cicloRegra'
