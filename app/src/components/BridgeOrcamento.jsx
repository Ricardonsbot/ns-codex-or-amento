import { computeBridge } from '../lib/dashboardData'
import { useUnidade } from './UnidadeProvider'

/**
 * A ponte Revenue → EBITDA after Capex em barras: cada degrau começa onde o
 * anterior parou, para se ver o quanto cada gasto come da receita.
 *
 * Recebe os três números em R$ cheios, com gasto positivo, e deriva o EBITDA
 * e o EBITDA after Capex — é a mesma conta que o Dashboard fazia.
 */
export default function BridgeOrcamento({ receita, despesa, capex, titulo, subtitulo }) {
  const { comMoeda } = useUnidade()
  const bridge = computeBridge({ receita, despesa, capex })

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>{titulo ?? 'Resumo do Orçamento — Revenue → EBITDA after Capex'}</h2>
          {subtitulo && <p>{subtitulo}</p>}
        </div>
      </div>
      <div className="panel-body">
        <div className="bridge-chart">
          <div className="bridge-col">
            <div className="bridge-value">{comMoeda(bridge.receita)}</div>
            <div className="bridge-track"><div className="bridge-bar receita" style={{ bottom: `${bridge.bars.receita.bottom}%`, height: `${bridge.bars.receita.height}%` }} /></div>
            <div className="bridge-label"><span className="bridge-sign">(+)</span>Revenue</div>
          </div>
          <div className="bridge-connector">
            <div className="bridge-value">&nbsp;</div>
            <div className="bridge-connector-track"><div className="bridge-connector-line" style={{ bottom: `${bridge.bars.receita.height}%` }} /></div>
            <div className="bridge-label">&nbsp;</div>
          </div>
          <div className="bridge-col">
            <div className="bridge-value">{comMoeda(-Math.abs(bridge.despesa))}</div>
            <div className="bridge-track"><div className="bridge-bar despesa" style={{ bottom: `${bridge.bars.despesa.bottom}%`, height: `${bridge.bars.despesa.height}%` }} /></div>
            <div className="bridge-label"><span className="bridge-sign">(−)</span>Expenses</div>
          </div>
          <div className="bridge-connector">
            <div className="bridge-value">&nbsp;</div>
            <div className="bridge-connector-track"><div className="bridge-connector-line" style={{ bottom: `${bridge.bars.ebitda.height}%` }} /></div>
            <div className="bridge-label">&nbsp;</div>
          </div>
          <div className="bridge-col">
            <div className="bridge-value">{comMoeda(bridge.ebitda)}</div>
            <div className="bridge-track"><div className="bridge-bar subtotal" style={{ bottom: `${bridge.bars.ebitda.bottom}%`, height: `${bridge.bars.ebitda.height}%` }} /></div>
            <div className="bridge-label">EBITDA</div>
          </div>
          <div className="bridge-connector">
            <div className="bridge-value">&nbsp;</div>
            <div className="bridge-connector-track"><div className="bridge-connector-line" style={{ bottom: `${bridge.bars.ebitda.height}%` }} /></div>
            <div className="bridge-label">&nbsp;</div>
          </div>
          <div className="bridge-col">
            <div className="bridge-value">{comMoeda(-Math.abs(bridge.capex))}</div>
            <div className="bridge-track"><div className="bridge-bar capex" style={{ bottom: `${bridge.bars.capex.bottom}%`, height: `${bridge.bars.capex.height}%` }} /></div>
            <div className="bridge-label"><span className="bridge-sign">(−)</span>Capex</div>
          </div>
          <div className="bridge-connector">
            <div className="bridge-value">&nbsp;</div>
            <div className="bridge-connector-track"><div className="bridge-connector-line" style={{ bottom: `${bridge.bars.ebitdaAfterCapex.height}%` }} /></div>
            <div className="bridge-label">&nbsp;</div>
          </div>
          <div className="bridge-col">
            <div className="bridge-value">{comMoeda(bridge.ebitdaAfterCapex)}</div>
            <div className="bridge-track"><div className="bridge-bar final" style={{ bottom: `${bridge.bars.ebitdaAfterCapex.bottom}%`, height: `${bridge.bars.ebitdaAfterCapex.height}%` }} /></div>
            <div className="bridge-label">EBITDA after Capex</div>
          </div>
        </div>
      </div>
    </div>
  )
}
