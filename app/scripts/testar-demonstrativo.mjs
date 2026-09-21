/**
 * Teste do demonstrativo da Master, sem banco nem navegador:
 *
 *   cd app
 *   node scripts/testar-demonstrativo.mjs
 *
 * Confere as fórmulas contra as da própria Master (aba P&L Contábil), a
 * classificação das contas nas linhas e o recorte MTD / YTD / FY. Sai com
 * código != 0 se algo falhar.
 */
import { classificar, demonstrativo, janela, categoriaCapex, PL_CONTABIL } from '../src/lib/demonstrativo.js'
import { versaoReferencia, cicloDoAno } from '../src/lib/cicloRegra.js'
import { casar } from '../src/lib/casarTemplateOrcamento.js'

let falhas = 0
const ok = (cond, msg) => {
  console.log(`${cond ? '  ok  ' : ' FALHA'} ${msg}`)
  if (!cond) falhas++
}
const m = (x) => Array(12).fill(0).map((_, i) => (i === 0 ? x : 0))
const conta = (linha_pl, codigo = '', nome = '') => ({ linha_pl, codigo, nome })

// ---- classificação ----------------------------------------------------------
ok(classificar({ tipo: 'receita', conta: conta('Receita > Gross Revenue') }) === 'gr', 'receita bruta')
ok(classificar({ tipo: 'despesa', conta: conta('Despesas > Personnel Costs'), area: 'COGS' }) === 'cogs', 'pessoal em COGS vai para COGS')
ok(classificar({ tipo: 'despesa', conta: conta('Despesas > Personnel Costs'), area: 'Others Income and Expense', area_ajustada: 'Bad Debts Provision' }) === 'bd', 'área ajustada manda sobre a área')
ok(classificar({ tipo: 'despesa', conta: conta('Despesas > Travels/Rental/Generals'), area: '' }) === 'semArea', 'gasto sem área não some')
ok(classificar({ tipo: 'despesa', conta: conta('Despesas > Financial Results', '4.7.10.001.002') }) === 'finRev', 'receita financeira pelo código 4.7.10.001')
ok(classificar({ tipo: 'despesa', conta: conta('Despesas > Financial Results', '4.7.10.002.003') }) === 'finExp', 'despesa financeira pelo código 4.7.10.002')
ok(classificar({ tipo: 'despesa', conta: conta('Despesas > IR/CSLL', '5.1', 'IMPOSTO DE RENDA DIFERIDO') }) === 'taxDef', 'imposto diferido')
ok(classificar({ tipo: 'despesa', conta: conta('Despesas > IR/CSLL', '5.1', 'IRPJ') }) === 'taxCur', 'imposto corrente')
ok(classificar({ tipo: 'capex', conta: conta('Despesas > Personnel Costs', '4.7.03.001.003') }) === 'capex:ativacao', 'salário no módulo Capex é ativação')
ok(classificar({ tipo: 'capex', conta: conta('Capex', '1.2.07.001.002') }) === 'capex:software', 'capex de software')
ok(categoriaCapex(conta('Capex', '1.2.05.003.002')) === 'equipamentos', 'informática é equipamento')
ok(categoriaCapex(conta('Capex', '1.2.05.003.001')) === 'benfeitorias', 'benfeitoria')
ok(classificar({ tipo: 'despesa', conta: null }) === null, 'sem conta devolve null (vira aviso)')
ok(classificar({ tipo: 'despesa', conta: conta('Outra Coisa') }) === 'fora:Outra Coisa', 'linha desconhecida vira aviso')

// ---- fórmulas: os números da Master (YTD Jul-26, P&L Contábil) ----------------
// Gasto entra positivo (como no banco); a Master mostra negativo.
const base = new Map(
  Object.entries({
    gr: 849.8,
    ded: -69.7,
    cogs: 262.6,
    ga: 98.4,
    sm: 108.8,
    rd: 120.0,
    bd: 5.9,
    others: 1.1,
    buAlloc: -25.3,
    shared: -30.8,
    holding: 56.1,
    daOp: 27.3,
    maAmort: 33.2,
    finRev: -24.1,
    finExp: 28.9,
    taxCur: 28.0,
    taxDef: 8.2,
    'capex:software': 50.6,
  }).map(([k, v]) => [k, m(v)])
)
const d = demonstrativo((k) => base.get(k))
const a = (s) => Math.round(d[s][0] * 10) / 10
ok(a('nr') === 780.1, `Net Revenue ${a('nr')} (Master 780,2 — arredondamento das parcelas)`)
ok(a('gm') === 517.5, `Gross Margin ${a('gm')}`)
ok(a('expenses') === -334.2, `Expenses ${a('expenses')} (Master -334,3)`)
ok(a('adjEbitda') === 183.3, `Adjusted EBITDA ${a('adjEbitda')}`)
ok(a('mgmtEbitda') === 183.3, `Managerial EBITDA ${a('mgmtEbitda')}`)
ok(a('da') === -60.5, `D&A ${a('da')}`)
ok(a('fin') === -4.8, `Financial Results ${a('fin')} (Master -4,9)`)
ok(a('tax') === -36.2, `Income Tax ${a('tax')} (Master -36,1)`)
ok(a('adjNi') === 81.8, `Adjusted Net Income ${a('adjNi')} (Master 81,7)`)
ok(a('eac') === 132.7, `Adj. EBITDA After Capex ${a('eac')}`)
ok(a('rdCapex') === -170.6, `R&D + Capex ${a('rdCapex')}`)

// ---- janela ------------------------------------------------------------------
const serie = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
ok(janela(serie, 'MTD', 7) === 7, 'MTD de julho é julho')
ok(janela(serie, 'YTD', 7) === 28, 'YTD de julho é jan–jul')
ok(janela(serie, 'FY') === 78, 'FY é o ano')
ok(janela(serie, 'YTD', 12) === janela(serie, 'FY'), 'YTD de dezembro é o ano')

// ---- esqueleto na ordem da Master ------------------------------------------
const ordem = PL_CONTABIL.map((l) => l.rotulo)
ok(ordem[0] === 'Gross Revenue' && ordem.at(-1) === '= Adjusted EBITDA After Capex', 'P&L começa em Gross Revenue e termina no EAC')
ok(ordem.indexOf('Managerial EBITDA') > ordem.indexOf('(-) Holding - Cost Sharing'), 'Managerial EBITDA depois das alocações')

// ---- ciclos --------------------------------------------------------------------
const ciclos = [
  { ano: 2026, versao: [{ id: 'r', tipo: 'revisao', status: 'rascunho', criada_em: '2' }, { id: 'o', tipo: 'original', status: 'ativa', criada_em: '1' }] },
  { ano: 2025, versao: [{ id: 'x', tipo: 'original', status: 'encerrada', criada_em: '1' }] },
]
ok(versaoReferencia(cicloDoAno(ciclos, 2026)).id === 'o', 'referência do ano é a versão ativa')
ok(versaoReferencia(cicloDoAno(ciclos, 2025)).id === 'x', 'ano encerrado usa a Original como Last Year')
ok(cicloDoAno(ciclos, 2027) === null, 'template de ano sem ciclo não cai em outro ano')

// ---- Despesa e Capex dividem a Base Gastos sem perder nem duplicar ---------
{
  const contas = [
    { id: 'p', codigo: '4.7.03.001.003', nome: 'DECIMO TERCEIRO', linha_pl: 'Despesas > Personnel Costs' },
    { id: 'm', codigo: '1.2.05.003.004', nome: 'MAQUINAS', linha_pl: 'Capex' },
    { id: 'n', codigo: '4.7.03.004.007', nome: 'NUVEM', linha_pl: 'Despesas > Telecomunication / Technology expenses' },
  ]
  const empresas = [{ id: 'e', nome: 'Log.One' }]
  const v = [{ mes: 1, valor: 10 }]
  const bg = [
    { linha: 1, aba: 'Base Gastos', empresa: 'Log.One', contaCodigo: '4.7.03.004.007', area: 'COGS', valores: v },
    { linha: 2, aba: 'Base Gastos', empresa: 'Log.One', contaCodigo: '1.2.05.003.004', area: 'Capex', valores: v },
    { linha: 3, aba: 'Base Gastos', empresa: 'Log.One', contaCodigo: '4.7.03.001.003', area: 'Capex', valores: v },
  ]
  // Template 2026: aba Capex vazia e o Capex lançado na Base Gastos.
  const d = casar({ tipo: 'despesa', aba: 'Base Gastos', linhas: bg }, { empresas, contas })
  const c = casar({ tipo: 'capex', aba: 'Capex + Base Gastos', linhas: bg }, { empresas, contas })
  const naDespesa = [...d.prontas, ...d.marcadas].map((x) => x.linha)
  const noCapex = [...c.prontas, ...c.marcadas].map((x) => x.linha)
  ok(naDespesa.join() === '1', 'Despesa fica só com o gasto')
  ok(noCapex.join() === '2,3', 'Capex pega a máquina e o salário ativado da Base Gastos')
  ok(naDespesa.length + noCapex.length === bg.length, 'nenhuma linha fica fora dos dois módulos')
  ok(c.prontas.find((x) => x.linha === 3)?.conta?.id === 'p', 'salário ativado entra com a conta de pessoal')
  // Linha da aba Capex própria não passa pelo filtro da Base Gastos.
  const propria = casar({ tipo: 'capex', aba: 'Capex', linhas: [{ ...bg[1], aba: 'Capex', area: '' }] }, { empresas, contas })
  ok(propria.prontas.length === 1, 'linha da aba Capex própria entra direto')
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo passou')
process.exitCode = falhas ? 1 : 0
