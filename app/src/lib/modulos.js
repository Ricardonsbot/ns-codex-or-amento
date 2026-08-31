// Nome de módulo pra cada item selecionável na barra lateral — usado como padrão de
// nomenclatura dos arquivos exportados/importados: "Modulo_Tela.xlsx"
// (ex.: Cadastros_ContaContabeis.xlsx). Módulos sem sub-telas usam só o próprio nome.
export const MODULOS = {
  DASHBOARD: 'Dashboard',
  REVENUE: 'Revenue',
  EXPENSES: 'Expenses',
  CAPEX: 'Capex',
  APROVACOES: 'Aprovacoes',
  RELATORIOS: 'Relatorios',
  CADASTROS: 'Cadastros',
  BUDGET_SETTINGS: 'BudgetSettings',
}

export function nomeArquivoExportacao(modulo, tela) {
  return tela ? `${modulo}_${tela}` : modulo
}
