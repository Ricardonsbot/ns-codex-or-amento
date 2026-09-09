import { supabase } from './supabaseClient'

/**
 * O resultado do que foi lançado, no formato do P&L Contábil.
 *
 * A linha do P&L de cada lançamento vem do plano de contas (`conta.linha_pl`),
 * não do tipo: é o plano que sabe se uma despesa é Pessoal ou D&A. O tipo só
 * diz o sinal.
 *
 * Nada aqui calcula dedução nem reajuste: soma o que está gravado. Se a
 * dedução não foi lançada, a Receita Líquida sai igual à Bruta — e a tela
 * mostra isso em vez de esconder.
 */

/** A ordem do P&L. `chave` casa com conta.linha_pl; `subtotal` é calculado. */
export const ESTRUTURA = [
  { chave: 'Receita > Gross Revenue', rotulo: 'Receita Bruta', sinal: 1 },
  { chave: 'Receita > (-) Deductions', rotulo: '(−) Deduções', sinal: 1 },
  { subtotal: 'receitaLiquida', rotulo: 'Receita Líquida' },

  { chave: 'Despesas > Personnel Costs', rotulo: '(−) Pessoal', sinal: -1, acimaDoEbitda: true },
  { chave: 'Despesas > Third Party Services & Mkt', rotulo: '(−) Terceiros e Marketing', sinal: -1, acimaDoEbitda: true },
  { chave: 'Despesas > Telecomunication / Technology expenses', rotulo: '(−) Tecnologia', sinal: -1, acimaDoEbitda: true },
  { chave: 'Despesas > Travels/Rental/Generals', rotulo: '(−) Viagens, Aluguéis e Gerais', sinal: -1, acimaDoEbitda: true },
  { chave: 'Despesas > Shared Services', rotulo: '(−) Shared Services', sinal: -1, acimaDoEbitda: true },
  { chave: 'Despesas > Holding - Cost Sharing', rotulo: '(−) Holding — Cost Sharing', sinal: -1, acimaDoEbitda: true },
  { chave: 'Despesas > BU Allocation', rotulo: '(−) BU Allocation', sinal: -1, acimaDoEbitda: true },
  { subtotal: 'ebitda', rotulo: 'EBITDA' },

  { chave: 'Despesas > D&A', rotulo: '(−) D&A', sinal: -1 },
  { chave: 'Despesas > M&A Amortization', rotulo: '(−) Amortização M&A', sinal: -1 },
  { chave: 'Despesas > Financial Results', rotulo: '(−) Resultado Financeiro', sinal: -1 },
  { chave: 'Despesas > Equivalência Patrimonial', rotulo: '(−) Equivalência Patrimonial', sinal: -1 },
  { chave: 'Despesas > Others Income and Expense', rotulo: '(−) Outras Receitas e Despesas', sinal: -1 },
  { chave: 'Despesas > IR/CSLL', rotulo: '(−) IR/CSLL', sinal: -1 },
  { subtotal: 'netIncome', rotulo: 'Net Income' },

  { chave: 'Capex', rotulo: '(−) Capex', sinal: -1 },
  { subtotal: 'ebitdaAposCapex', rotulo: 'EBITDA after Capex' },
]

const CONHECIDAS = new Set(ESTRUTURA.filter((l) => l.chave).map((l) => l.chave))
const zeros = () => Array(12).fill(0)
const somar = (a, b) => a.map((v, i) => v + b[i])

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
        mapa.set(prefixo, { nivel, nome, receita: zeros(), despesa: zeros(), capex: zeros() })
      }
      const no = mapa.get(prefixo)
      no[it.tipo] = somar(no[it.tipo], it.meses)
    }
  }
  return { estrutura: [...mapa.entries()].map(([chave, no]) => ({ chave, ...no })), arvore: montarArvore(mapa) }
}

export async function fetchResultado(versaoId, { buId, torreId, empresaId } = {}) {
  const linhas = []
  for (let de = 0; ; de += 1000) {
    let q = supabase
      .from('lancamento')
      .select(
        'tipo, area, bu_id, bu:bu_id(nome), torre_id, torre:torre_id(nome), sub_torre_id, sub_torre:sub_torre_id(nome), empresa_id, empresa:empresa_id(nome), conta:conta_id(codigo, nome, linha_pl), lancamento_valor_mensal(mes, valor)'
      )
      .eq('versao_id', versaoId)
    if (buId) q = q.eq('bu_id', buId)
    if (torreId) q = q.eq('torre_id', torreId)
    if (empresaId) q = q.eq('empresa_id', empresaId)
    const { data, error } = await q.range(de, de + 999)
    if (error) throw error
    linhas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const porLinha = new Map()   // linha_pl -> 12 meses
  const porArea = new Map()    // area -> 12 meses
  const porEmpresa = new Map() // empresa -> { nome, linhas: Map, receita, despesa, capex }
  let semConta = zeros()
  const itens = []

  for (const l of linhas) {
    const meses = zeros()
    for (const v of l.lancamento_valor_mensal ?? []) meses[v.mes - 1] += Number(v.valor)

    const chave = l.conta?.linha_pl ?? null
    if (!chave) semConta = somar(semConta, meses)
    else porLinha.set(chave, somar(porLinha.get(chave) ?? zeros(), meses))

    if (l.tipo !== 'receita') {
      const a = l.area || 'Sem área'
      porArea.set(a, somar(porArea.get(a) ?? zeros(), meses))
    }

    // O mesmo corte por empresa, que é o recorte do P&L gerencial.
    const eid = l.empresa_id ?? 'sem-empresa'
    if (!porEmpresa.has(eid)) {
      porEmpresa.set(eid, {
        id: l.empresa_id,
        nome: l.empresa?.nome ?? 'Sem Empresa',
        linhas: new Map(),
        receita: zeros(),
        despesa: zeros(),
        capex: zeros(),
      })
    }
    const e = porEmpresa.get(eid)
    e[l.tipo] = somar(e[l.tipo], meses)
    if (chave) e.linhas.set(chave, somar(e.linhas.get(chave) ?? zeros(), meses))

    itens.push({
      tipo: l.tipo,
      meses,
      bu: { id: l.bu_id, nome: l.bu?.nome },
      torre: { id: l.torre_id, nome: l.torre?.nome },
      sub: { id: l.sub_torre_id, nome: l.sub_torre?.nome },
      empresa: { id: l.empresa_id, nome: l.empresa?.nome },
    })
  }

  const agrupado = agruparPorEstrutura(itens)

  // Linhas do plano que existem nos dados mas não estão na estrutura do P&L.
  const fora = [...porLinha.keys()].filter((k) => !CONHECIDAS.has(k))

  const valorDe = (chave) => porLinha.get(chave) ?? zeros()
  const receitaBruta = valorDe('Receita > Gross Revenue')
  const deducoes = valorDe('Receita > (-) Deductions')
  const receitaLiquida = somar(receitaBruta, deducoes)

  const acima = ESTRUTURA.filter((l) => l.acimaDoEbitda).reduce((a, l) => somar(a, valorDe(l.chave)), zeros())
  const ebitda = receitaLiquida.map((v, i) => v - acima[i])

  const abaixo = ESTRUTURA.filter((l) => l.chave && l.sinal === -1 && !l.acimaDoEbitda && l.chave !== 'Capex')
    .reduce((a, l) => somar(a, valorDe(l.chave)), zeros())
  const netIncome = ebitda.map((v, i) => v - abaixo[i])

  const capex = valorDe('Capex')
  const ebitdaAposCapex = ebitda.map((v, i) => v - capex[i])

  const subtotais = { receitaLiquida, ebitda, netIncome, ebitdaAposCapex }

  const pl = ESTRUTURA.map((l) =>
    l.subtotal
      ? { ...l, valores: subtotais[l.subtotal], eSubtotal: true }
      : { ...l, valores: valorDe(l.chave) }
  )

  return {
    pl,
    subtotais,
    receitaBruta,
    deducoes,
    capex,
    semConta,
    fora: fora.map((k) => ({ chave: k, valores: porLinha.get(k) })),
    empresas: [...porEmpresa.values()]
      .map((e) => {
        const valorDeEmp = (c) => e.linhas.get(c) ?? zeros()
        const receitaLiquida = somar(valorDeEmp('Receita > Gross Revenue'), valorDeEmp('Receita > (-) Deductions'))
        const acimaEmp = ESTRUTURA.filter((l) => l.acimaDoEbitda).reduce((a, l) => somar(a, valorDeEmp(l.chave)), zeros())
        const ebitdaEmp = receitaLiquida.map((v, i) => v - acimaEmp[i])
        return {
          id: e.id,
          nome: e.nome,
          receitaLiquida,
          ebitda: ebitdaEmp,
          ebitdaAposCapex: ebitdaEmp.map((v, i) => v - e.capex[i]),
          capex: e.capex,
          porLinha: e.linhas,
        }
      })
      .sort((a, b) => anual(b.receitaLiquida) - anual(a.receitaLiquida) || a.nome.localeCompare(b.nome)),
    areas: [...porArea.entries()]
      .map(([nome, valores]) => ({ nome, valores }))
      .sort((a, b) => anual(b.valores) - anual(a.valores)),
    // A chave do caminho volta junto: é ela que casa o mesmo nó entre duas
    // versões na comparação com o Budget.
    estrutura: agrupado.estrutura,
    arvore: agrupado.arvore,
    lancamentos: linhas.length,
  }
}

/**
 * O demonstrativo a partir de linhas soltas — { linhaPl, meses } —, sem passar
 * pelo banco. É o que deixa a conferência da importação mostrar o P&L do que
 * ainda vai entrar, com a mesma ordem e os mesmos subtotais do Resultado.
 */
export function montarPL(itens) {
  const porLinha = new Map()
  let semConta = zeros()
  for (const it of itens) {
    if (!it.linhaPl) semConta = somar(semConta, it.meses)
    else porLinha.set(it.linhaPl, somar(porLinha.get(it.linhaPl) ?? zeros(), it.meses))
  }

  const valorDe = (chave) => porLinha.get(chave) ?? zeros()
  const receitaLiquida = somar(valorDe('Receita > Gross Revenue'), valorDe('Receita > (-) Deductions'))
  const acima = ESTRUTURA.filter((l) => l.acimaDoEbitda).reduce((a, l) => somar(a, valorDe(l.chave)), zeros())
  const ebitda = receitaLiquida.map((v, i) => v - acima[i])
  const abaixo = ESTRUTURA.filter((l) => l.chave && l.sinal === -1 && !l.acimaDoEbitda && l.chave !== 'Capex')
    .reduce((a, l) => somar(a, valorDe(l.chave)), zeros())
  const netIncome = ebitda.map((v, i) => v - abaixo[i])
  const capex = valorDe('Capex')
  const ebitdaAposCapex = ebitda.map((v, i) => v - capex[i])
  const subtotais = { receitaLiquida, ebitda, netIncome, ebitdaAposCapex }

  return {
    pl: ESTRUTURA.map((l) =>
      l.subtotal
        ? { ...l, valores: subtotais[l.subtotal], eSubtotal: true }
        : { ...l, valores: valorDe(l.chave) }
    ),
    subtotais,
    semConta,
    fora: [...porLinha.keys()]
      .filter((k) => !CONHECIDAS.has(k))
      .map((k) => ({ chave: k, valores: porLinha.get(k) })),
  }
}

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
    lista.sort((a, b) => anual(b.receita) - anual(a.receita) || a.nome.localeCompare(b.nome))
    for (const n of lista) ordenar(n.filhos)
  }
  ordenar(raiz)
  return raiz
}

/**
 * A árvore em lista, na ordem de leitura e com a numeração do painel — 1, 1.1,
 * 1.1.1 — como no P&L Contábil que o time usa.
 */
export function achatar(arvore, prefixo = '') {
  const saida = []
  arvore.forEach((no, i) => {
    const numero = prefixo ? `${prefixo}.${i + 1}` : `${i + 1}`
    saida.push({ ...no, numero })
    saida.push(...achatar(no.filhos, numero))
  })
  return saida
}

/**
 * Semáforo do painel. O corte é uma escolha, não uma regra contábil: acima do
 * comparativo é verde, até 5% abaixo é amarelo, abaixo disso é vermelho. Se o
 * FP&A usar outro corte, é aqui que muda.
 */
export function semaforo(pct) {
  if (pct === null || !isFinite(pct)) return null
  if (pct >= 0) return 'verde'
  if (pct >= -5) return 'amarelo'
  return 'vermelho'
}

/** As versões do ciclo, para escolher contra qual comparar. */
export async function fetchVersoesDoCiclo(cicloId) {
  const { data, error } = await supabase
    .from('versao')
    .select('id, nome, tipo, status')
    .eq('ciclo_id', cicloId)
    .order('criada_em')
  if (error) throw error
  return data ?? []
}

export const anual = (v) => (v ?? []).reduce((a, b) => a + b, 0)

/**
 * Variação contra o comparativo. Quando a base é zero não existe percentual —
 * devolve null em vez de infinito, e a tela mostra travessão.
 */
export function variacao(atual, comparado) {
  const delta = atual - comparado
  return { delta, pct: comparado ? (delta / Math.abs(comparado)) * 100 : null }
}

/** Percentual sobre a receita líquida — a base que o P&L da NSTECH usa. */
export const percentual = (valor, base) => (base ? (valor / base) * 100 : null)
