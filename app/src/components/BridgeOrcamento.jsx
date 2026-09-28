import { computeBridge } from '../lib/dashboardData'
import GraficoBridge from './GraficoBridge'

/**
 * A ponte Revenue → EBITDA after Capex.
 *
 * Desenha com o mesmo GraficoBridge das outras cascatas — as pontas e o
 * EBITDA em barra cinza cheia, os gastos como caixinhas que descem, e o fio
 * pontilhado ligando um ao outro. O EBITDA vai marcado como total: ele não é
 * uma variação, é onde a conta reabre no chão, e o Capex parte dele.
 *
 * Recebe os três números em R$ cheios, com gasto positivo, e deriva o EBITDA
 * e o EBITDA after Capex — é a mesma conta que o Dashboard fazia.
 */
export default function BridgeOrcamento({ receita, despesa, capex, titulo, subtitulo }) {
  const bridge = computeBridge({ receita, despesa, capex })

  const cascata = {
    inicio: { rotulo: '(+) Revenue', valor: bridge.receita },
    degraus: [
      { rotulo: '(−) Expenses', valor: -Math.abs(bridge.despesa) },
      { rotulo: 'EBITDA', valor: bridge.ebitda, tipo: 'total' },
      { rotulo: '(−) Capex', valor: -Math.abs(bridge.capex) },
    ],
    fim: { rotulo: 'EBITDA after Capex', valor: bridge.ebitdaAfterCapex },
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>{titulo ?? 'Resumo do Orçamento — Revenue → EBITDA after Capex'}</h2>
          {subtitulo && <p>{subtitulo}</p>}
        </div>
      </div>
      <div className="panel-body">
        <GraficoBridge cascata={cascata} moldura={false} />
      </div>
    </div>
  )
}
