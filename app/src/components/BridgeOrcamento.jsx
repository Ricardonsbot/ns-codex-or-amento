import { computeBridge } from '../lib/dashboardData'

/**
 * A ponte Revenue → EBITDA after Capex.
 *
 * Monta a cascata para o mesmo GraficoBridge das outras pontes — as pontas e
 * o EBITDA em barra cinza cheia, os gastos como caixinhas que descem. O
 * EBITDA vai marcado como total: ele não é uma variação, é onde a conta
 * reabre no chão, e o Capex parte dele. O painel em volta é de quem desenha:
 * no Dashboard, ela divide o quadro com o mês a mês.
 *
 * Recebe os três números em R$ cheios, com gasto positivo, e deriva o EBITDA
 * e o EBITDA after Capex — é a mesma conta que o Dashboard fazia.
 */
export function cascataOrcamento({ receita, despesa, capex }) {
  const bridge = computeBridge({ receita, despesa, capex })
  return {
    inicio: { rotulo: '(+) Revenue', valor: bridge.receita },
    degraus: [
      { rotulo: '(−) Expenses', valor: -Math.abs(bridge.despesa) },
      { rotulo: 'EBITDA', valor: bridge.ebitda, tipo: 'total' },
      { rotulo: '(−) Capex', valor: -Math.abs(bridge.capex) },
    ],
    fim: { rotulo: 'EBITDA after Capex', valor: bridge.ebitdaAfterCapex },
  }
}
