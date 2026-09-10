import { anual, percentual, variacao, achatar, semaforo } from '../lib/resultadoData'

/** R$ M com uma casa, que é o formato #,##0.0 do Master Resultado. */
const milhoes = (v) =>
  (Number(v ?? 0) / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const pctSimples = (v) =>
  v === null || !isFinite(v)
    ? '—'
    : `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const pctComSinal = (v) =>
  v === null || !isFinite(v)
    ? '—'
    : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

/** O ícone do painel: verde acima de +3%, vermelho abaixo de −3%. */
function Ponto({ pct }) {
  return <span className={`ponto ponto-${semaforo(pct) || 'neutro'}`} aria-hidden="true" />
}

/**
 * Um grupo de medida: Actual, %NR, Budget, Δ, Δ% e o semáforo.
 *
 * Δ e Δ% saem sem cor de propósito — na planilha quem sinaliza bom ou ruim é o
 * ícone, e pintar o número também deixaria a linha com dois sinais brigando.
 */
function Medida({ atual, budget, base, comparando, menorEMelhor, comNR }) {
  const { delta, pct } = variacao(atual, budget ?? 0)
  return (
    <>
      <td className="vao" />
      <td className="valor">{milhoes(atual)}</td>
      {/* %NR é participação, não variação: vai sem sinal de mais. */}
      {comNR && <td>{pctSimples(percentual(atual, base))}</td>}
      {comparando && (
        <>
          <td className="valor">{milhoes(budget)}</td>
          <td>
            {delta > 0 ? '+' : ''}
            {milhoes(delta)}
          </td>
          <td>{pctComSinal(pct)}</td>
          <td className="icone">
            <Ponto pct={menorEMelhor && pct !== null ? -pct : pct} />
          </td>
        </>
      )}
    </>
  )
}

/** Actual / Budget / Δ / Δ% / semáforo de um grupo, na linha de rótulos. */
function Rotulos({ comparando, comNR }) {
  return (
    <>
      <th className="vao" />
      <th className="atual">Actual</th>
      {comNR && <th>%NR</th>}
      {comparando && (
        <>
          <th className="orcado">Budget</th>
          <th>Δ</th>
          <th>Δ%</th>
          <th className="icone" />
        </>
      )}
    </>
  )
}

/** Consolidado, BU, Torre, Sub Torre, Empresa — cada nível tem seu tratamento. */
const CLASSE_NIVEL = ['bu', 'torre', 'sub', '']

/**
 * O Painel Resultado, no formato da aba "Painel Resultado" do Master Resultado:
 * índice e nome à esquerda, faixa laranja por grupo de medida, valores em R$ M
 * centralizados e o semáforo fechando cada grupo.
 *
 * Serve tanto ao Resultado (dados do banco) quanto à conferência da importação
 * (dados ainda em memória) — por isso recebe a árvore pronta, e não a versão.
 */
export default function PainelResultado({ arvore, consolidado, comparacao, titulo, subtitulo }) {
  const linhas = achatar(arvore)
  const comp = comparacao?.estrutura
  const base = consolidado?.receita ?? 0
  // Cada grupo abre com o vão branco; o segundo ainda ganha a coluna de %NR.
  const colsNR = comp ? 6 : 2
  const colsEAC = comp ? 7 : 3

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>{titulo ?? 'Painel Resultado'}</h2>
          <p>{subtitulo ?? 'Consolidado → BU → Torre → Sub Torre → Empresa'}</p>
        </div>
      </div>
      <div className="panel-body">
        <div className="rolagem-x">
          <table className="tabela-xl">
            <thead>
              <tr className="faixa">
                <th className="canto fixa-1" />
                <th className="canto fixa-2">[ BRL M ]</th>
                <th className="vao" />
                <th colSpan={colsNR - 1}>Net Revenue</th>
                <th className="vao" />
                <th colSpan={colsEAC - 1}>Adj. Ebitda After Capex</th>
              </tr>
              <tr className="rotulos">
                <th className="fixa-1" />
                <th className="rotulo fixa-2" />
                <Rotulos comparando={!!comp} />
                <Rotulos comparando={!!comp} comNR />
              </tr>
            </thead>
            <tbody>
              {consolidado && (
                <>
                  <tr className="consolidado">
                    <td className="indice fixa-1">=</td>
                    <td className="rotulo fixa-2">Consolidado</td>
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
                  <tr className="respiro">
                    <td colSpan={2 + colsNR + colsEAC} />
                  </tr>
                </>
              )}
              {linhas.map((no) => {
                const nb = comp?.find((x) => x.chave === no.chave)
                const rec = anual(no.receita)
                const eac = rec - anual(no.despesa) - anual(no.capex)
                const recB = anual(nb?.receita ?? [])
                const eacB = recB - anual(nb?.despesa ?? []) - anual(nb?.capex ?? [])
                return (
                  <tr key={no.chave} className={CLASSE_NIVEL[Math.min(no.nivel, 3)]}>
                    <td className="indice fixa-1">{no.numero}</td>
                    <td className="rotulo fixa-2" style={{ paddingLeft: 6 + no.nivel * 12 }}>
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
          <p className="nota-tabela">
            O semáforo usa os mesmos cortes do Master Resultado: verde acima de +3% do comparativo, amarelo entre
            −3% e +3%, vermelho abaixo de −3%.
          </p>
        )}
      </div>
    </div>
  )
}
