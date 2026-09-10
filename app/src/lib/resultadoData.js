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

/**
 * O esqueleto do P&L, na ordem da aba "P&L Contábil" do Master Resultado: vai
 * de Gross Revenue até Adjusted EBITDA After Capex com todas as linhas.
 *
 * As três visões compartilham este esqueleto e diferem em UM trecho — o bloco
 * operacional, entre a Receita Líquida e o Adjusted EBITDA:
 *
 *   conta   as quatro linhas de natureza do plano de contas (Pessoal,
 *           Terceiros, Tecnologia, Viagens) — é o P&L linha a linha;
 *   funcao  COGS, G&A, S&M, R&D — vem da coluna "Alocação PnL (Área)";
 *   pacote  o mesmo pacote da visão conta, aberto em subpacote.
 *
 * As três somam o mesmo total porque partem do mesmo conjunto de lançamentos:
 * os que caem em NATUREZA_OPERACIONAL. Conferido contra o banco — 293,3 mi por
 * natureza e 293,3 mi por área, sem sobra.
 *
 * Linha com `linha` casa com conta.linha_pl; com `area`, com lancamento.area;
 * com `pacote`, com lancamento.pacote. `subtotal` é calculado.
 */

/** As linhas do plano que formam o bloco operacional (acima do EBITDA). */
export const NATUREZA_OPERACIONAL = [
  { linha: 'Despesas > Personnel Costs', rotulo: '(−) Pessoal' },
  { linha: 'Despesas > Third Party Services & Mkt', rotulo: '(−) Terceiros e Marketing' },
  { linha: 'Despesas > Telecomunication / Technology expenses', rotulo: '(−) Tecnologia' },
  { linha: 'Despesas > Travels/Rental/Generals', rotulo: '(−) Viagens, Aluguéis e Gerais' },
]

const OPERACIONAL = new Set(NATUREZA_OPERACIONAL.map((l) => l.linha))

/** O bloco operacional de cada visão. */
const BLOCO = {
  conta: NATUREZA_OPERACIONAL.map((l) => ({ ...l, sinal: -1 })),

  funcao: [
    { area: 'COGS', rotulo: '(−) COGS', sinal: -1 },
    { subtotal: 'margemBruta', rotulo: 'Gross Margin', forte: true },
    { secao: true, rotulo: '(−) Expenses' },
    { area: 'G&A', rotulo: '(−) General & Administrative', sinal: -1 },
    { area: 'S&M', rotulo: '(−) Sales & Marketing', sinal: -1 },
    { area: 'R&D', rotulo: '(−) Research & Development', sinal: -1 },
    { area: 'Bad Debts Provision', rotulo: '(−) Bad Debts Provision', sinal: -1 },
  ],

  // Os subpacotes entram em tempo de montagem, sob o pacote a que pertencem.
  pacote: NATUREZA_OPERACIONAL.map((l) => ({ ...l, sinal: -1, abrePacote: true })),
}

/** Do Adjusted EBITDA para baixo é igual nas três visões. */
const ABAIXO = [
  { linha: 'Despesas > Others Income and Expense', rotulo: '(+/−) Others Income & Exp.', sinal: -1 },
  { subtotal: 'ebitdaAjustado', rotulo: 'Adjusted EBITDA', forte: true },
  { linha: 'Despesas > BU Allocation', rotulo: '(+/−) BU Allocation', sinal: -1 },
  { linha: 'Despesas > Shared Services', rotulo: '(+/−) Shared Services', sinal: -1 },
  { linha: 'Despesas > Holding - Cost Sharing', rotulo: '(−) Holding - Cost Sharing', sinal: -1 },
  { subtotal: 'ebitda', rotulo: 'EBITDA', forte: true },
  { secao: true, rotulo: '(−) D&A' },
  { linha: 'Despesas > D&A', rotulo: '(−) D&A Operating Assets', sinal: -1 },
  { linha: 'Despesas > M&A Amortization', rotulo: '(−) M&A Amortization', sinal: -1 },
  { linha: 'Despesas > Financial Results', rotulo: '(+/−) Financial Results', sinal: -1 },
  { linha: 'Despesas > Equivalência Patrimonial', rotulo: '(+/−) Equivalência Patrimonial', sinal: -1 },
  { linha: 'Despesas > IR/CSLL', rotulo: '(−) Income Tax', sinal: -1 },
  { subtotal: 'netIncome', rotulo: 'Net Income', forte: true },
  { linha: 'Capex', rotulo: '(−) Capex', sinal: -1 },
  { subtotal: 'ebitdaAposCapex', rotulo: 'Adjusted EBITDA After Capex', forte: true },
]

const ACIMA = [
  { linha: 'Receita > Gross Revenue', rotulo: 'Gross Revenue', sinal: 1 },
  { linha: 'Receita > (-) Deductions', rotulo: '(−) Deductions', sinal: 1 },
  { subtotal: 'receitaLiquida', rotulo: 'Net Revenue', forte: true },
]

/** O esqueleto inteiro de uma visão. */
export const esqueleto = (visao = 'conta') => [...ACIMA, ...(BLOCO[visao] ?? BLOCO.conta), ...ABAIXO]

export const VISOES = [
  { valor: 'conta', rotulo: 'Linha contábil' },
  { valor: 'funcao', rotulo: 'COGS / G&A / S&M / R&D' },
  { valor: 'pacote', rotulo: 'Pacote e subpacote' },
]

/**
 * A ESTRUTURA que o resto da ferramenta já usava. Continua sendo a visão por
 * linha contábil, para o painel e a conferência não mudarem de significado.
 */
export const ESTRUTURA = esqueleto('conta')

const CONHECIDAS = new Set(
  [...ACIMA, ...BLOCO.conta, ...ABAIXO].filter((l) => l.linha).map((l) => l.linha)
)

const zeros = () => Array(12).fill(0)
const somar = (a, b) => a.map((v, i) => v + b[i])

/**
 * Os subtotais do P&L a partir de uma função que devolve os 12 meses de uma
 * linha do plano. Uma só implementação serve ao consolidado, a cada empresa e à
 * conferência da importação — antes a mesma conta estava escrita três vezes e
 * era só questão de tempo até divergirem.
 *
 * `valorArea` é opcional e só serve à Margem Bruta, que precisa do COGS: a
 * conferência da importação não tem área por linha e recebe null ali.
 */
function calcularSubtotais(valorDe, valorArea) {
  const receitaBruta = valorDe('Receita > Gross Revenue')
  const deducoes = valorDe('Receita > (-) Deductions')
  const receitaLiquida = somar(receitaBruta, deducoes)

  const operacional = NATUREZA_OPERACIONAL.reduce((a, l) => somar(a, valorDe(l.linha)), zeros())
  // O Master lança Others Income & Exp. acima do Adjusted EBITDA, não abaixo.
  const outras = valorDe('Despesas > Others Income and Expense')
  const ebitdaAjustado = receitaLiquida.map((v, i) => v - operacional[i] - outras[i])

  const alocacoes = ['Despesas > BU Allocation', 'Despesas > Shared Services', 'Despesas > Holding - Cost Sharing']
    .reduce((a, c) => somar(a, valorDe(c)), zeros())
  const ebitda = ebitdaAjustado.map((v, i) => v - alocacoes[i])

  const abaixoDoEbitda = [
    'Despesas > D&A',
    'Despesas > M&A Amortization',
    'Despesas > Financial Results',
    'Despesas > Equivalência Patrimonial',
    'Despesas > IR/CSLL',
  ].reduce((a, c) => somar(a, valorDe(c)), zeros())
  const netIncome = ebitda.map((v, i) => v - abaixoDoEbitda[i])

  const capex = valorDe('Capex')
  const ebitdaAposCapex = ebitda.map((v, i) => v - capex[i])

  // Sem área não dá para separar o COGS do resto, e Margem Bruta fica de fora.
  const margemBruta = valorArea
    ? receitaLiquida.map((v, i) => v - valorArea('COGS')[i])
    : null

  return {
    receitaBruta,
    deducoes,
    receitaLiquida,
    margemBruta,
    ebitdaAjustado,
    ebitda,
    netIncome,
    capex,
    ebitdaAposCapex,
  }
}

/**
 * O esqueleto de uma visão preenchido com os valores.
 *
 * `subpacotesDe` devolve os pares [nome, meses] de um pacote; quando a coluna
 * de subpacote ainda não existe no banco ele devolve lista vazia e a visão de
 * pacote fica igual à de linha contábil, sem quebrar.
 */
function montarLinhas(visao, subtotais, valorDe, valorArea, subpacotesDe) {
  const saida = []
  for (const l of esqueleto(visao)) {
    if (l.subtotal) {
      const valores = subtotais[l.subtotal]
      if (!valores) continue // Margem Bruta sem área: a linha some, não zera
      saida.push({ ...l, valores, eSubtotal: true })
      continue
    }
    if (l.secao) {
      saida.push({ ...l, valores: null, eSecao: true })
      continue
    }
    if (l.area) {
      saida.push({ ...l, valores: valorArea ? valorArea(l.area) : zeros() })
      continue
    }
    saida.push({ ...l, valores: valorDe(l.linha) })
    if (l.abrePacote && subpacotesDe) {
      for (const [nome, valores] of subpacotesDe(l.linha)) {
        saida.push({ rotulo: nome, valores, eSubpacote: true, sinal: -1 })
      }
    }
  }
  return saida
}

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

/**
 * O PostgREST recusa a consulta inteira quando um dos campos do select não
 * existe, então a coluna de subpacote é sondada uma vez por sessão. Enquanto a
 * migração 2026-09-10 não rodar, a visão de pacote fica sem a abertura e o
 * resto da tela segue igual.
 */
let temSubpacote = null
async function sondarSubpacote() {
  if (temSubpacote !== null) return temSubpacote
  const { error } = await supabase.from('lancamento').select('pacote, subpacote').limit(1)
  temSubpacote = !error
  return temSubpacote
}

export async function fetchResultado(versaoId, { buId, torreId, empresaId } = {}) {
  const comSubpacote = await sondarSubpacote()
  const campos =
    'tipo, area, bu_id, bu:bu_id(nome), torre_id, torre:torre_id(nome), sub_torre_id, ' +
    'sub_torre:sub_torre_id(nome), empresa_id, empresa:empresa_id(nome), ' +
    'conta:conta_id(codigo, nome, linha_pl), lancamento_valor_mensal(mes, valor)' +
    (comSubpacote ? ', pacote, subpacote' : '')
  const linhas = []
  for (let de = 0; ; de += 1000) {
    let q = supabase
      .from('lancamento')
      .select(campos)
      .eq('versao_id', versaoId)
    if (buId) q = q.eq('bu_id', buId)
    if (torreId) q = q.eq('torre_id', torreId)
    if (empresaId) q = q.eq('empresa_id', empresaId)
    const { data, error } = await q.range(de, de + 999)
    if (error) throw error
    linhas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const porLinha = new Map()      // linha_pl -> 12 meses
  const porArea = new Map()       // area -> 12 meses (só do bloco operacional)
  const porSubpacote = new Map()  // linha_pl -> Map(subpacote -> 12 meses)
  const semSubpacote = new Map()  // linha_pl -> 12 meses das linhas sem subpacote
  const porEmpresa = new Map()    // empresa -> { nome, linhas, areas, ... }
  let semConta = zeros()
  const itens = []

  for (const l of linhas) {
    const meses = zeros()
    for (const v of l.lancamento_valor_mensal ?? []) meses[v.mes - 1] += Number(v.valor)

    const chave = l.conta?.linha_pl ?? null
    if (!chave) semConta = somar(semConta, meses)
    else porLinha.set(chave, somar(porLinha.get(chave) ?? zeros(), meses))

    // A área só é somada dentro do bloco operacional. Fora dele — Capex, D&A,
    // rateios — a coluna existe mas não pertence a nenhuma linha de Expenses,
    // e somá-la faria a visão por área não bater com a por natureza.
    const noBloco = chave ? OPERACIONAL.has(chave) : false
    if (noBloco) {
      const a = l.area || 'Sem área'
      porArea.set(a, somar(porArea.get(a) ?? zeros(), meses))
      const sp = l.subpacote
      if (sp) {
        if (!porSubpacote.has(chave)) porSubpacote.set(chave, new Map())
        const m = porSubpacote.get(chave)
        m.set(sp, somar(m.get(sp) ?? zeros(), meses))
      } else {
        // O que sobra sem subpacote e somado a parte para virar linha propria.
        // Sem isso ele sumia: os subpacotes somavam menos que o pacote e a
        // diferenca ficava sem explicacao nenhuma na tela.
        semSubpacote.set(chave, somar(semSubpacote.get(chave) ?? zeros(), meses))
      }
    }

    // O mesmo corte por empresa, que é o recorte do P&L gerencial.
    const eid = l.empresa_id ?? 'sem-empresa'
    if (!porEmpresa.has(eid)) {
      porEmpresa.set(eid, {
        id: l.empresa_id,
        nome: l.empresa?.nome ?? 'Sem Empresa',
        linhas: new Map(),
        areas: new Map(),
        receita: zeros(),
        despesa: zeros(),
        capex: zeros(),
      })
    }
    const e = porEmpresa.get(eid)
    e[l.tipo] = somar(e[l.tipo], meses)
    if (chave) e.linhas.set(chave, somar(e.linhas.get(chave) ?? zeros(), meses))
    if (noBloco) {
      const a = l.area || 'Sem área'
      e.areas.set(a, somar(e.areas.get(a) ?? zeros(), meses))
    }

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
  const valorArea = (a) => porArea.get(a) ?? zeros()
  const subpacotesDe = (linha) => {
    const reais = [...(porSubpacote.get(linha) ?? new Map()).entries()].sort(
      (a, b) => anual(b[1]) - anual(a[1])
    )
    // O resto so aparece quando ha subpacote de verdade naquele pacote: se
    // nenhum tem, a abertura inteira seria uma linha "(sem subpacote)" igual
    // ao pacote, que nao diz nada.
    const resto = semSubpacote.get(linha)
    if (reais.length && resto && anual(resto) !== 0) reais.push(['(sem subpacote)', resto])
    return reais
  }

  const subtotais = calcularSubtotais(valorDe, valorArea)
  const { receitaBruta, deducoes, capex } = subtotais

  // As três visões, prontas: trocar de visão na tela não volta ao banco.
  const pls = Object.fromEntries(
    VISOES.filter((v) => v.valor !== 'pacote' || porSubpacote.size > 0).map((v) => [
      v.valor,
      montarLinhas(v.valor, subtotais, valorDe, valorArea, subpacotesDe),
    ])
  )
  const pl = pls.conta

  return {
    pl,
    pls,
    subtotais,
    receitaBruta,
    deducoes,
    capex,
    semConta,
    fora: fora.map((k) => ({ chave: k, valores: porLinha.get(k) })),
    empresas: [...porEmpresa.values()]
      .map((e) => {
        // Todo lançamento carrega a empresa, então as linhas se somam direto,
        // sem rateio nenhum — e o cálculo é o mesmo do consolidado.
        const valorDeEmp = (c) => e.linhas.get(c) ?? zeros()
        const valorAreaEmp = (a) => e.areas.get(a) ?? zeros()
        const st = calcularSubtotais(valorDeEmp, valorAreaEmp)
        return {
          id: e.id,
          nome: e.nome,
          receitaLiquida: st.receitaLiquida,
          margemBruta: st.margemBruta,
          ebitdaAjustado: st.ebitdaAjustado,
          ebitda: st.ebitda,
          netIncome: st.netIncome,
          ebitdaAposCapex: st.ebitdaAposCapex,
          capex: e.capex,
          porLinha: e.linhas,
          porArea: e.areas,
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
  const porArea = new Map()
  let semConta = zeros()
  for (const it of itens) {
    if (!it.linhaPl) semConta = somar(semConta, it.meses)
    else porLinha.set(it.linhaPl, somar(porLinha.get(it.linhaPl) ?? zeros(), it.meses))
    if (it.linhaPl && OPERACIONAL.has(it.linhaPl) && it.area) {
      porArea.set(it.area, somar(porArea.get(it.area) ?? zeros(), it.meses))
    }
  }

  const valorDe = (chave) => porLinha.get(chave) ?? zeros()
  const valorArea = porArea.size ? (a) => porArea.get(a) ?? zeros() : null
  const subtotais = calcularSubtotais(valorDe, valorArea)

  return {
    pl: montarLinhas('conta', subtotais, valorDe, valorArea, null),
    // Sem a visão de pacote: ela só faz sentido aberta em subpacote, e o que
    // está em memória ainda não passou pela gravação que separa os dois.
    pls: Object.fromEntries(
      VISOES.filter((v) => v.valor !== 'pacote').map((v) => [
        v.valor,
        montarLinhas(v.valor, subtotais, valorDe, valorArea, null),
      ])
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
  // Os cortes sao os mesmos do icone do Master Resultado: verde acima de +3%,
  // vermelho abaixo de -3%, amarelo no meio.
  if (pct >= 3) return 'verde'
  if (pct >= -3) return 'amarelo'
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
