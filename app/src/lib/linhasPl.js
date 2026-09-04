/**
 * Que contas do plano pertencem a cada tipo de lançamento.
 *
 * Fica num módulo só e sem dependência de leitura de planilha, porque a regra é
 * usada em dois lugares que não podem divergir: a importação do template e o
 * seletor de conta da tela de lançamento. Quando estavam separados, a tela
 * deixava lançar receita numa conta de capex enquanto a importação recusava.
 */
export const PREFIXO_PL = { receita: 'Receita', despesa: 'Despesas', capex: 'Capex' }

export function contasDoTipo(contas, tipo) {
  const prefixo = PREFIXO_PL[tipo]
  if (!prefixo) return contas
  return contas.filter((c) => (c.linha_pl || '').startsWith(prefixo))
}
