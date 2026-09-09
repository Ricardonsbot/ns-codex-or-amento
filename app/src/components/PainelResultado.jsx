import { anual, percentual, variacao, achatar, semaforo } from '../lib/resultadoData'

const milhoes = (v) => (Number(v ?? 0) / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const pctSimples = (v) =>
  v === null || !isFinite(v) ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const pctComSinal = (v) =>
  v === null || !isFinite(v)
    ? '—'
    : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

/** O ponto do painel: acima do comparativo, perto dele, ou longe. */
function Ponto({ pct }) {
  const cor = semaforo(pct)
  return <span className={`ponto ponto-${cor || 'neutro'}`} aria-hidden="true" />
}

/** Um grupo de medida: Actual, %NR, Budget, Δ, Δ% e o ponto. */
function Medida({ atual, budget, base, comparando, menorEMelhor, comNR, divisor }) {
  const { delta, pct } = variacao(atual, budget ?? 0)
  const bom = menorEMelhor ? delta < 0 : delta > 0
  const cor = delta === 0 ? '' : bom ? 'melhor' : 'pior'
  return (
    <>
      <td className={`text-right${divisor ? ' divisor' : ''}`}>{milhoes(atual)}</td>
      {/* %NR é participação, não variação: vai sem sinal de mais. */}
      {comNR && <td className="text-right apagado">{pctSimples(percentual(atual, base))}</td>}
      {comparando && (
        <>
          <td className="text-right apagado">{milhoes(budget)}</td>
          <td className={`text-right ${cor}`}>
            {delta > 0 ? '+' : ''}
            {milhoes(delta)}
          </td>
          <td className={`text-right ${cor}`}>{pctComSinal(pct)}</td>
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
  // Cada grupo tem Actual e, comparando, mais Budget/Δ/Δ%/ponto. O segundo
  // ainda ganha a coluna de %NR.
  const colsNR = comp ? 5 : 1
  const colsEAC = comp ? 6 : 2

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>
            {titulo ?? 'Painel Resultado'}
            <span className="selo-unidade">BRL M</span>
          </h2>
          <p>{subtitulo ?? 'Consolidado → BU → Torre → Sub Torre → Empresa'}</p>
        </div>
      </div>
      <div className="panel-body">
        <div className="rolagem-x">
          <table className="data-table tabela-pl">
            <thead>
              <tr className="grupo">
                <th className="vazio fixa" />
                <th colSpan={colsNR}>Net Revenue</th>
                <th colSpan={colsEAC} className="divisor">Adj. EBITDA after Capex</th>
              </tr>
              <tr className="sub">
                <th className="fixa">Estrutura</th>
                <th className="text-right">Actual</th>
                {comp && <th className="text-right">Budget</th>}
                {comp && <th className="text-right">Δ</th>}
                {comp && <th className="text-right">Δ%</th>}
                {comp && <th />}
                <th className="text-right divisor">Actual</th>
                <th className="text-right">%NR</th>
                {comp && <th className="text-right">Budget</th>}
                {comp && <th className="text-right">Δ</th>}
                {comp && <th className="text-right">Δ%</th>}
                {comp && <th />}
              </tr>
            </thead>
            <tbody>
              {consolidado && (
                <tr className="consolidado">
                  <td className="fixa">
                    <span className="numero" />
                    Consolidado
                  </td>
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
                    divisor
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
                  <tr key={no.chave} className={no.nivel === 0 ? 'forte' : undefined}>
                    <td className="fixa" style={{ paddingLeft: 10 + no.nivel * 14 }}>
                      <span className="numero">{no.numero}</span>
                      {no.nome}
                    </td>
                    <Medida atual={rec} budget={recB} base={rec} comparando={!!comp} />
                    <Medida atual={eac} budget={eacB} base={rec} comparando={!!comp} comNR divisor />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {comp && (
          <p className="nota-tabela">
            O ponto é verde acima do comparativo, amarelo até 5% abaixo e vermelho abaixo disso. O corte é uma
            escolha da ferramenta, não uma regra contábil.
          </p>
        )}
      </div>
    </div>
  )
}
