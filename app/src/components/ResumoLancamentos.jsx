import { useMemo } from 'react'
import { useUnidade } from './UnidadeProvider'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const mil = (v) =>
  Math.abs(v) >= 1000
    ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`
    : v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })

/**
 * O resumo é por CONTA. Era por empresa, com botões para trocar; virou só
 * conta porque é assim que se confere um orçamento contra o plano — e o
 * recorte de empresa já vem dos filtros da tela.
 */

/**
 * Resumo do que está lançado: os doze meses em gráfico e a mesma coisa aberta
 * em tabela, uma linha por conta.
 *
 * Não calcula nada além de somar. O que aparece aqui é exatamente o que está
 * gravado — se veio da importação, é o que a planilha trouxe.
 */
export default function ResumoLancamentos({ linhas, rotulo }) {
  const { numero, comMoeda } = useUnidade()

  const { grupos, porMes, total } = useMemo(() => {
    const mapa = new Map()
    const meses = Array(12).fill(0)

    for (const l of linhas) {
      const nome = l.conta ? `${l.conta.codigo} — ${l.conta.nome}` : 'Sem conta'

      if (!mapa.has(nome)) mapa.set(nome, { nome, valores: Array(12).fill(0), linhas: 0 })
      const g = mapa.get(nome)
      g.linhas += 1
      l.valores.forEach((v, i) => {
        g.valores[i] += v
        meses[i] += v
      })
    }

    const lista = [...mapa.values()].map((g) => ({ ...g, total: g.valores.reduce((a, b) => a + b, 0) }))
    lista.sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
    return { grupos: lista, porMes: meses, total: meses.reduce((a, b) => a + b, 0) }
  }, [linhas])

  if (!linhas.length) return null

  // Escala do gráfico. Com valores negativos o eixo fica no meio.
  const maxAbs = Math.max(...porMes.map(Math.abs), 1)
  const temNegativo = porMes.some((v) => v < 0)
  // O passo largo é o que deixa o gráfico ocupar a largura do painel sem
  // ficar alto: o viewBox guarda a proporção, e 12 × 120 por ~96 de altura dá
  // uma faixa baixa mesmo numa tela grande.
  const ALTURA = 96
  const base = temNegativo ? ALTURA / 2 : ALTURA
  const PASSO = 120
  const largura = PASSO * 12
  const alcance = (temNegativo ? ALTURA / 2 : ALTURA) * 0.82
  const x = (i) => i * PASSO + PASSO / 2
  const y = (v) => base - (v / maxAbs) * alcance
  const pontos = porMes.map((v, i) => `${x(i)},${y(v)}`).join(' ')

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>Resumo de {rotulo}</h2>
          <p>
            {linhas.length} lançamento(s) · {grupos.length} conta(s) · total {comMoeda(total)}
          </p>
        </div>
      </div>

      <div className="panel-body">
        {/* Gráfico de linha: um ponto por mês, com o valor escrito em cima.
            viewBox no lugar de largura fixa, para o desenho ocupar a largura
            inteira do painel. */}
        <div style={{ marginBottom: 18 }}>
          <svg
            viewBox={`0 0 ${largura} ${ALTURA + 26}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', height: 'auto', display: 'block' }}
            role="img"
            aria-label={`Total por mês de ${rotulo}`}
          >
            <line x1="0" y1={base} x2={largura} y2={base} stroke="currentColor" opacity="0.25" />
            <polyline
              points={pontos}
              fill="none"
              stroke="var(--color-primary, #ff3d03)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {porMes.map((v, i) => (
              <g key={i}>
                <circle
                  cx={x(i)}
                  cy={y(v)}
                  r="3"
                  fill={v < 0 ? 'var(--color-danger, #c0392b)' : 'var(--color-primary, #ff3d03)'}
                  opacity={v === 0 ? 0.3 : 1}
                />
                <text
                  x={x(i)}
                  y={v < 0 ? y(v) + 12 : y(v) - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fill="currentColor"
                  opacity={v === 0 ? 0.35 : 0.75}
                >
                  {mil(v)}
                </text>
                <text x={x(i)} y={ALTURA + 20} textAnchor="middle" fontSize="12" fill="currentColor" opacity="0.6">
                  {MESES[i]}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* A mesma coisa em número */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>CONTA</th>
                {MESES.map((m) => (
                  <th key={m} className="text-right">{m.toUpperCase()}</th>
                ))}
                <th className="text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.nome}>
                  <td style={{ minWidth: 190 }}>
                    <strong>{g.nome}</strong>
                    {g.linhas > 1 && (
                      <span style={{ opacity: 0.55, fontSize: 12 }}> · {g.linhas} lançamentos</span>
                    )}
                  </td>
                  {g.valores.map((v, i) => (
                    <td key={i} className="text-right" style={{ fontSize: 12, opacity: v === 0 ? 0.3 : 1 }}>
                      {v === 0 ? '—' : numero(v)}
                    </td>
                  ))}
                  <td className="text-right"><strong>{numero(g.total)}</strong></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td><strong>Total</strong></td>
                {porMes.map((v, i) => (
                  <td key={i} className="text-right" style={{ fontSize: 12 }}>
                    <strong>{v === 0 ? '—' : numero(v)}</strong>
                  </td>
                ))}
                <td className="text-right"><strong>{numero(total)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
