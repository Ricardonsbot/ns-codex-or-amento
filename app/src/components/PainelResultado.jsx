import { anual, percentual, variacao, achatar, semaforo } from '../lib/resultadoData'

const milhoes = (v) => (Number(v ?? 0) / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const pctSimples = (v) =>
  v === null || !isFinite(v) ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const pctComSinal = (v) =>
  v === null || !isFinite(v)
    ? '—'
    : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

const COR = { verde: '#1a7f47', amarelo: '#d99a00', vermelho: '#c0392b' }

/** O ponto do painel: acima do comparativo, perto dele, ou longe. */
function Ponto({ pct }) {
  const cor = COR[semaforo(pct)]
  if (!cor) return <span style={{ opacity: 0.25 }}>·</span>
  return <span style={{ color: cor, fontSize: 15 }} aria-hidden="true">●</span>
}

/** Um grupo de medida: Actual, %NR, Budget, Δ, Δ% e o ponto. */
function Medida({ atual, budget, base, comparando, menorEMelhor, comNR }) {
  const { delta, pct } = variacao(atual, budget ?? 0)
  const bom = menorEMelhor ? delta < 0 : delta > 0
  const cor = delta === 0 ? 'inherit' : bom ? COR.verde : COR.vermelho
  return (
    <>
      <td className="text-right">{milhoes(atual)}</td>
      {/* %NR é participação, não variação: vai sem sinal de mais. */}
      {comNR && <td className="text-right" style={{ opacity: 0.75 }}>{pctSimples(percentual(atual, base))}</td>}
      {comparando && (
        <>
          <td className="text-right" style={{ opacity: 0.75 }}>{milhoes(budget)}</td>
          <td className="text-right" style={{ color: cor }}>
            {delta > 0 ? '+' : ''}
            {milhoes(delta)}
          </td>
          <td className="text-right" style={{ color: cor }}>{pctComSinal(pct)}</td>
          <td className="text-center"><Ponto pct={menorEMelhor && pct !== null ? -pct : pct} /></td>
        </>
      )}
    </>
  )
}

/**
 * O Painel Resultado, no modelo do P&L Contábil que o time já lê: hierarquia
 * numerada nas linhas, grupos de medida nas colunas, valores em BRL M.
 *
 * Serve tanto ao Resultado (dados do banco) quanto à conferência da importação
 * (dados ainda em memória) — por isso recebe a árvore pronta, e não a versão.
 */
export default function PainelResultado({ arvore, consolidado, comparacao, titulo, subtitulo }) {
  const linhas = achatar(arvore)
  const comp = comparacao?.estrutura
  const base = consolidado?.receita ?? 0

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>{titulo ?? 'Painel Resultado'}</h2>
          <p>{subtitulo ?? '[ BRL M ] · Consolidado → BU → Torre → Sub Torre → Empresa'}</p>
        </div>
      </div>
      <div className="panel-body">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table painel-resultado">
            <thead>
              <tr>
                <th />
                <th className="text-center" colSpan={comp ? 5 : 1}>NET REVENUE</th>
                <th className="text-center" colSpan={comp ? 6 : 2}>ADJ. EBITDA AFTER CAPEX</th>
              </tr>
              <tr>
                <th>ESTRUTURA</th>
                <th className="text-right">ACTUAL</th>
                {comp && <th className="text-right">BUDGET</th>}
                {comp && <th className="text-right">Δ</th>}
                {comp && <th className="text-right">Δ%</th>}
                {comp && <th />}
                <th className="text-right">ACTUAL</th>
                <th className="text-right">%NR</th>
                {comp && <th className="text-right">BUDGET</th>}
                {comp && <th className="text-right">Δ</th>}
                {comp && <th className="text-right">Δ%</th>}
                {comp && <th />}
              </tr>
            </thead>
            <tbody>
              {consolidado && (
                <tr style={{ fontWeight: 700, background: 'var(--color-surface-alt, #f2f4f7)' }}>
                  <td>= Consolidado</td>
                  <Medida
                    atual={consolidado.receita}
                    budget={comparacao?.consolidado?.receita ?? 0}
                    base={base}
                    comparando={!!comp}
                  />
                  <Medida
                    atual={consolidado.ebitdaAposCapex}
                    budget={comparacao?.consolidado?.ebitdaAposCapex ?? 0}
                    base={base}
                    comparando={!!comp}
                    comNR
                  />
                </tr>
              )}
              {linhas.map((no) => {
                const nb = comp?.find((x) => x.chave === no.chave)
                const rec = anual(no.receita)
                const eac = rec - anual(no.despesa) - anual(no.capex)
                const recB = anual(nb?.receita ?? [])
                const eacB = recB - anual(nb?.despesa ?? []) - anual(nb?.capex ?? [])
                return (
                  <tr key={no.chave} style={no.nivel === 0 ? { fontWeight: 700 } : undefined}>
                    <td style={{ paddingLeft: 12 + no.nivel * 16, whiteSpace: 'nowrap' }}>
                      <span style={{ opacity: 0.5, marginRight: 8, fontSize: 11 }}>{no.numero}</span>
                      {no.nome}
                    </td>
                    <Medida atual={rec} budget={recB} base={rec} comparando={!!comp} />
                    <Medida atual={eac} budget={eacB} base={rec} comparando={!!comp} comNR />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {comp && (
          <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            O ponto é verde acima do comparativo, amarelo até 5% abaixo e vermelho abaixo disso. O corte é uma
            escolha da ferramenta, não uma regra contábil.
          </p>
        )}
      </div>
    </div>
  )
}
