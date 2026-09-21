/**
 * O demonstrativo no formato da Master Resultado.
 *
 * Todo quadro do Resultado sai daqui: P&L Contábil, Budget mês a mês, Painel
 * Resumo, os painéis por estrutura e os big numbers. O caminho é sempre o
 * mesmo — cada lançamento cai numa CHAVE BASE (`classificar`), as chaves são
 * somadas por mês em qualquer recorte (consolidado, empresa, nó da árvore) e
 * `demonstrativo` monta as linhas da Master a partir delas.
 *
 * Sinal da Master: receita positiva, gasto negativo. No banco o gasto é
 * gravado positivo; a troca acontece aqui, uma vez só.
 *
 * Módulo puro, sem banco, para ser testado no Node.
 */

export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export const zeros = () => Array(12).fill(0)
export const somar = (a, b) => a.map((v, i) => v + (b?.[i] ?? 0))
const neg = (a) => a.map((v) => -v)
const soma = (...xs) => xs.reduce((a, b) => somar(a, b), zeros())
const digitos = (v) => String(v ?? '').replace(/\D/g, '')

/** As linhas do plano (conta.linha_pl) que formam o bloco operacional. */
export const NATUREZAS_OPERACIONAIS = new Set([
  'Despesas > Personnel Costs',
  'Despesas > Third Party Services & Mkt',
  'Despesas > Telecomunication / Technology expenses',
  'Despesas > Travels/Rental/Generals',
])

/** A área do template (Alocação PnL) para a linha da Master. */
const AREA = {
  COGS: 'cogs',
  'G&A': 'ga',
  'S&M': 'sm',
  'R&D': 'rd',
  'BAD DEBTS PROVISION': 'bd',
  'OTHERS INCOME AND EXPENSE': 'others',
}

/** Categoria do Capex no quadro "Capex (YTD)" da Master, pela conta. */
export function categoriaCapex(conta) {
  const d = digitos(conta?.codigo)
  if (!d || d.startsWith('1207')) return 'software' // intangível, e a ativação de salário
  if (['1205003002', '1205003004', '1205003006'].some((p) => d.startsWith(p))) return 'equipamentos'
  return 'benfeitorias'
}

/**
 * A chave base do lançamento. `null` quando não há como classificar — sem conta
 * — e 'fora:<linha>' quando a conta tem uma linha que o demonstrativo não
 * conhece; nos dois casos o valor aparece como aviso, nunca some calado.
 */
export function classificar(l) {
  const conta = l.conta
  if (l.tipo === 'capex') {
    // Conta de despesa no módulo Capex é salário ativado (ver o casamento da
    // importação): conta a natureza, a área diz que é investimento.
    const ativacao = conta && !(conta.linha_pl || '').startsWith('Capex')
    return ativacao ? 'capex:ativacao' : `capex:${categoriaCapex(conta)}`
  }
  const lp = conta?.linha_pl
  if (!lp) return null
  if (lp === 'Receita > Gross Revenue') return 'gr'
  if (lp === 'Receita > (-) Deductions') return 'ded'
  if (NATUREZAS_OPERACIONAIS.has(lp)) {
    const a = String(l.area_ajustada || l.area || '').toUpperCase().trim()
    return AREA[a] ?? 'semArea'
  }
  if (lp === 'Despesas > Others Income and Expense') return 'others'
  if (lp === 'Despesas > BU Allocation') return 'buAlloc'
  if (lp === 'Despesas > Shared Services') return 'shared'
  if (lp === 'Despesas > Holding - Cost Sharing') return 'holding'
  if (lp === 'Despesas > D&A') return 'daOp'
  if (lp === 'Despesas > M&A Amortization') return 'maAmort'
  if (lp === 'Despesas > Financial Results') {
    return digitos(conta.codigo).startsWith('4710001') ? 'finRev' : 'finExp'
  }
  // A Master não tem linha de equivalência: ela entra no resultado financeiro.
  if (lp === 'Despesas > Equivalência Patrimonial') {
    return /POSITIV/i.test(conta.nome) ? 'finRev' : 'finExp'
  }
  if (lp === 'Despesas > IR/CSLL') return /DIFERID/i.test(conta.nome) ? 'taxDef' : 'taxCur'
  if (lp === 'Capex') return `capex:${categoriaCapex(conta)}`
  return `fora:${lp}`
}

/** As chaves de gasto que formam o "(-) Expenses" da Master (sem o COGS). */
export const CHAVES_EXPENSES = ['ga', 'sm', 'rd', 'bd', 'others', 'semArea']

/**
 * As linhas da Master a partir das chaves base. `v(chave)` devolve os 12 meses
 * gravados daquela chave (gasto positivo). As fórmulas são as da própria
 * Master, célula a célula (aba P&L Contábil, coluna do YTD):
 *
 *   Net Revenue ................. Gross Revenue + Deductions
 *   Gross Margin ................ Net Revenue + COGS
 *   Adjusted EBITDA ............. Gross Margin + Expenses
 *   Managerial EBITDA ........... Adjusted EBITDA + alocações
 *   EBITDA ...................... Managerial EBITDA + Non-recurring
 *   Adjusted Net Income ......... Managerial EBITDA + D&A + Financial + Tax
 *   Net Income .................. EBITDA + D&A + Financial + Tax + Non-recurring
 *   Adj. EBITDA After Capex ..... Adjusted EBITDA + Capex
 *
 * Non-recurring fica zerado: orçamento não tem ajuste não recorrente.
 */
export function demonstrativo(v) {
  const g = (k) => neg(v(k) ?? zeros())
  const s = {}
  s.gr = v('gr') ?? zeros()
  s.ded = v('ded') ?? zeros()
  s.nr = somar(s.gr, s.ded)
  s.cogs = g('cogs')
  s.gm = somar(s.nr, s.cogs)
  for (const k of CHAVES_EXPENSES) s[k] = g(k)
  s.expenses = soma(...CHAVES_EXPENSES.map((k) => s[k]))
  s.adjEbitda = somar(s.gm, s.expenses)
  s.buAlloc = g('buAlloc')
  s.shared = g('shared')
  s.holding = g('holding')
  s.mgmtEbitda = soma(s.adjEbitda, s.buAlloc, s.shared, s.holding)
  s.nrEbitda = zeros()
  s.ebitda = somar(s.mgmtEbitda, s.nrEbitda)
  s.daOp = g('daOp')
  s.maAmort = g('maAmort')
  s.da = somar(s.daOp, s.maAmort)
  s.adjEbit = somar(s.mgmtEbitda, s.da)
  s.finRev = g('finRev')
  s.finExp = g('finExp')
  s.fin = somar(s.finRev, s.finExp)
  s.adjEbt = somar(s.adjEbit, s.fin)
  s.taxCur = g('taxCur')
  s.taxDef = g('taxDef')
  s.tax = somar(s.taxCur, s.taxDef)
  s.adjNi = soma(s.mgmtEbitda, s.da, s.fin, s.tax)
  s.nrNi = zeros()
  s.ni = soma(s.ebitda, s.da, s.fin, s.tax, s.nrNi)
  s.capexSoftware = g('capex:software')
  s.capexEquip = g('capex:equipamentos')
  s.capexBenf = g('capex:benfeitorias')
  s.capexAtiv = g('capex:ativacao')
  s.capexPpe = soma(s.capexSoftware, s.capexEquip, s.capexBenf)
  s.capex = somar(s.capexPpe, s.capexAtiv)
  // No quadro de Capex a ativação é software: é desenvolvimento capitalizado.
  s.capexSoftwareTotal = somar(s.capexSoftware, s.capexAtiv)
  s.rdCapex = somar(s.rd, s.capex)
  s.eac = somar(s.adjEbitda, s.capex)
  return s
}

/**
 * P&L Contábil da Master, linha a linha e na mesma ordem. `tipo`:
 *   linha     valor do lançamento
 *   subtotal  "= ..." em faixa
 *   grupo     linha-mãe com valor e filhas recuadas ("(-) D&A")
 *   filha     recuada sob o grupo
 *   secao     título sem valor
 */
export const PL_CONTABIL = [
  { rotulo: 'Gross Revenue', s: 'gr', tipo: 'linha' },
  { rotulo: '(-) Deductions', s: 'ded', tipo: 'linha' },
  { rotulo: 'Net Revenue', s: 'nr', tipo: 'subtotal' },
  { rotulo: '(-) COGS', s: 'cogs', tipo: 'linha' },
  { rotulo: '= Gross Margin', s: 'gm', tipo: 'subtotal' },
  { rotulo: '(-) Expenses', s: 'expenses', tipo: 'grupo' },
  { rotulo: '(-) General & Administrative', s: 'ga', tipo: 'filha' },
  { rotulo: '(-) Sales & Marketing', s: 'sm', tipo: 'filha' },
  { rotulo: '(-) Research & Development', s: 'rd', tipo: 'filha' },
  { rotulo: '(-) Bad Debts Provision', s: 'bd', tipo: 'filha' },
  { rotulo: '(+/-) Others Income & Exp.', s: 'others', tipo: 'filha' },
  { rotulo: '(-) Sem área de alocação', s: 'semArea', tipo: 'filha', soComValor: true },
  { rotulo: '= Adjusted EBITDA', s: 'adjEbitda', tipo: 'subtotal' },
  { rotulo: '(+/-) BU Allocation', s: 'buAlloc', tipo: 'linha' },
  { rotulo: '(+/-) Shared Services', s: 'shared', tipo: 'linha' },
  { rotulo: '(-) Holding - Cost Sharing', s: 'holding', tipo: 'linha' },
  { rotulo: 'Managerial EBITDA', s: 'mgmtEbitda', tipo: 'subtotal' },
  { rotulo: '(+/-) Non-recurring', s: 'nrEbitda', tipo: 'linha' },
  { rotulo: '= EBITDA', s: 'ebitda', tipo: 'subtotal' },
  { rotulo: '(-) D&A', s: 'da', tipo: 'grupo' },
  { rotulo: '(-) D&A Operating Assets', s: 'daOp', tipo: 'filha' },
  { rotulo: '(-) M&A Amortization', s: 'maAmort', tipo: 'filha' },
  { rotulo: '(+/-) Financial Results', s: 'fin', tipo: 'grupo' },
  { rotulo: '(+) Financial Revenue', s: 'finRev', tipo: 'filha' },
  { rotulo: '(-) Financial Expenses', s: 'finExp', tipo: 'filha' },
  { rotulo: '(-) Income Tax', s: 'tax', tipo: 'grupo' },
  { rotulo: '(-) Current', s: 'taxCur', tipo: 'filha' },
  { rotulo: '(+/-) Deferred', s: 'taxDef', tipo: 'filha' },
  { rotulo: 'Adjusted Net Income', s: 'adjNi', tipo: 'subtotal' },
  { rotulo: '(+/-) Non-recurring', s: 'nrNi', tipo: 'linha' },
  { rotulo: '= Net Income', s: 'ni', tipo: 'subtotal' },
  { rotulo: '= Adjusted Net Income', s: 'adjNi', tipo: 'subtotal' },
  { rotulo: 'R&D + Capex', s: 'rdCapex', tipo: 'linha' },
  { rotulo: '(-) Capex', s: 'capex', tipo: 'linha' },
  { rotulo: '= Adjusted EBITDA After Capex', s: 'eac', tipo: 'subtotal' },
]

/**
 * Budget mês a mês da Master: a mesma conta com a ordem daquela aba, que não
 * é a do P&L Contábil — Holding vem antes de Shared Services, há Adjusted
 * EBIT e EBT, e o Capex abre em PP&E e ativação. `pct` é a linha "% NR" do
 * subtotal logo acima.
 */
export const PL_MES_A_MES = [
  { rotulo: 'Gross Revenue', s: 'gr', tipo: 'linha' },
  { rotulo: '(-) Deductions', s: 'ded', tipo: 'linha' },
  { rotulo: 'Net Revenue', s: 'nr', tipo: 'subtotal' },
  { rotulo: '(-) COGS', s: 'cogs', tipo: 'linha' },
  { rotulo: '= Gross Margin', s: 'gm', tipo: 'subtotal' },
  { rotulo: '% NR', s: 'gm', tipo: 'pct' },
  { rotulo: '(-) Expenses', s: 'expenses', tipo: 'grupo' },
  { rotulo: '(-) General & Administrative', s: 'ga', tipo: 'filha' },
  { rotulo: '(-) Sales & Marketing', s: 'sm', tipo: 'filha' },
  { rotulo: '(-) Research & Development', s: 'rd', tipo: 'filha' },
  { rotulo: '(-) Bad Debts Provision', s: 'bd', tipo: 'filha' },
  { rotulo: '(+/-) Others Income & Exp.', s: 'others', tipo: 'filha' },
  { rotulo: '(-) Sem área de alocação', s: 'semArea', tipo: 'filha', soComValor: true },
  { rotulo: '= Adjusted EBITDA', s: 'adjEbitda', tipo: 'subtotal' },
  { rotulo: '% NR', s: 'adjEbitda', tipo: 'pct' },
  { rotulo: '(+/-) BU Allocation', s: 'buAlloc', tipo: 'linha' },
  { rotulo: '(-) Holding - Cost Sharing', s: 'holding', tipo: 'linha' },
  { rotulo: '(+/-) Shared Services', s: 'shared', tipo: 'linha' },
  { rotulo: 'Managerial EBITDA', s: 'mgmtEbitda', tipo: 'subtotal' },
  { rotulo: '(+/-) Non-recurring', s: 'nrEbitda', tipo: 'linha' },
  { rotulo: '= EBITDA', s: 'ebitda', tipo: 'subtotal' },
  { rotulo: '(-) D&A', s: 'da', tipo: 'grupo' },
  { rotulo: '(-) D&A', s: 'daOp', tipo: 'filha' },
  { rotulo: '(-) M&A Amortization', s: 'maAmort', tipo: 'filha' },
  { rotulo: 'Adjusted EBIT', s: 'adjEbit', tipo: 'subtotal' },
  { rotulo: '(+/-) Financial Results', s: 'fin', tipo: 'linha' },
  { rotulo: 'Adjusted EBT', s: 'adjEbt', tipo: 'subtotal' },
  { rotulo: '(-) Income Tax', s: 'tax', tipo: 'grupo' },
  { rotulo: '(-) Income Tax', s: 'taxCur', tipo: 'filha' },
  { rotulo: '(+/-) Deferred Tax', s: 'taxDef', tipo: 'filha' },
  { rotulo: 'Adjusted Net Income', s: 'adjNi', tipo: 'subtotal' },
  { rotulo: '(+/-) Non-recurring', s: 'nrNi', tipo: 'linha' },
  { rotulo: '= Net Income', s: 'ni', tipo: 'subtotal' },
  { rotulo: 'R&D + Capex', s: 'rdCapex', tipo: 'linha' },
  { rotulo: '(-) Capex', s: 'capex', tipo: 'grupo' },
  { rotulo: '(-) Capex PP&E (na base)', s: 'capexPpe', tipo: 'filha' },
  { rotulo: '(-) Capex (Ativação)', s: 'capexAtiv', tipo: 'filha' },
  { rotulo: '% NR', s: 'capex', tipo: 'pct' },
  { rotulo: '= Adjusted EBITDA After Capex', s: 'eac', tipo: 'subtotal' },
  { rotulo: '% NR', s: 'eac', tipo: 'pct' },
]

/** Painel Resumo da Master: as linhas e, nas de margem, o numerador. */
export const RESUMO = [
  { rotulo: 'Net Revenue', s: 'nr' },
  { rotulo: 'Adj. EBITDA', s: 'adjEbitda' },
  { rotulo: 'Adj. EBITDA Margin [%]', pct: 'adjEbitda' },
  { rotulo: 'Capex', s: 'capex' },
  { rotulo: 'Capex / Net Revenue [%]', pct: 'capex' },
  { rotulo: 'Adj. EBITDA After CAPEX', s: 'eac' },
  { rotulo: 'Adj. EBITDA Af. CAPEX Margin [%]', pct: 'eac' },
]

/** As medidas do Painel Resultado MoM, na ordem dos blocos da Master. */
export const MEDIDAS_MOM = [
  { valor: 'nr', rotulo: 'Net Sales' },
  { valor: 'cogs', rotulo: '(-) CoGS' },
  { valor: 'ga', rotulo: '(-) General & Administrative' },
  { valor: 'sm', rotulo: '(-) Sales & Marketing' },
  { valor: 'rd', rotulo: '(-) Research & Development' },
  { valor: 'bd', rotulo: '(-) Bad Debts Provision' },
  { valor: 'others', rotulo: '(+/-) Others Income & Exp.' },
  { valor: 'capex', rotulo: '(-) Capex' },
  { valor: 'eac', rotulo: 'Adj. EBITDA After Capex' },
]

/** Os grupos do Capex (YTD) da Master. */
export const GRUPOS_CAPEX = [
  { s: 'capex', rotulo: 'Capex Total' },
  { s: 'capexSoftwareTotal', rotulo: 'Software' },
  { s: 'capexEquip', rotulo: 'Equipamentos' },
  { s: 'capexBenf', rotulo: 'Benfeitorias e outros' },
]

/**
 * O recorte de meses. MTD é o mês de referência; YTD, de janeiro até ele; FY,
 * o ano todo. Com dezembro, YTD e FY coincidem.
 */
export function janela(valores, periodo, mes) {
  const v = valores ?? []
  if (periodo === 'MTD') return v[mes - 1] ?? 0
  const ate = periodo === 'YTD' ? mes : 12
  let t = 0
  for (let i = 0; i < ate; i++) t += v[i] ?? 0
  return t
}

/** % sobre a receita líquida; null quando não há receita. */
export const pctNR = (valor, nr) => (nr ? (valor / Math.abs(nr)) * 100 : null)

/** ∆ e ∆% contra um comparativo. ∆% sobre o módulo, como na Master. */
export function delta(atual, comparado) {
  if (comparado === null || comparado === undefined) return { d: null, p: null }
  const d = atual - comparado
  return { d, p: comparado ? (d / Math.abs(comparado)) * 100 : null }
}

/** Soma chave a chave de um Map base num outro, criando o que faltar. */
export function acumular(base, chave, meses) {
  base.set(chave, somar(base.get(chave) ?? zeros(), meses))
}
