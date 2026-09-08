import { useMemo, useState } from 'react'
import FiltroBotoes from './FiltroBotoes'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const brl = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const mil = (v) =>
  Math.abs(v) >= 1000
    ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`
    : v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })

/**
 * Como agrupar as linhas na tabela. A chave é o que junta; o rótulo é o que
 * aparece. Empresa vem primeiro porque é por onde se confere o que foi
 * digitado — uma linha por empresa é o recorte que a pessoa reconhece.
 */
const AGRUPAMENTOS = [
  { chave: 'empresa', rotulo: 'Empresa' },
  { chave: 'conta', rotulo: 'Conta' },
  { chave: 'descricao', rotulo: 'Descrição' },
]

/**
 * Resumo do que está lançado: os doze meses em gráfico e a mesma coisa aberta
 * em tabela.
 *
 * Não calcula nada além de somar. O que aparece aqui é exatamente o que está
 * gravado — se veio da importação, é o que a planilha trouxe.
 */
export default function ResumoLancamentos({ linhas, empresas, rotulo }) {
  const [agrupar, setAgrupar] = useState('empresa')

  const nomeEmpresa = useMemo(
    () => new Map((empresas ?? []).map((e) => [e.id, e.nome])),
    [empresas]
  )

  const { grupos, porMes, total } = useMemo(() => {
    const mapa = new Map()
    const meses = Array(12).fill(0)

    for (const l of linhas) {
      const nome =
        agrupar === 'empresa'
          ? nomeEmpresa.get(l.empresa_id) ?? 'Sem empresa'
          : agrupar === 'conta'
          ? l.conta
            ? `${l.conta.codigo} — ${l.conta.nome}`
            : 'Sem conta'
          : l.descricao || 'Sem descrição'

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
  }, [linhas, agrupar, nomeEmpresa])

  if (!linhas.length) return null

  // Escala do gráfico. Com valores negativos o eixo fica no meio.
  const maxAbs = Math.max(...porMes.map(Math.abs), 1)
  const temNegativo = porMes.some((v) => v < 0)
  const ALTURA = 150
  const base = temNegativo ? ALTURA / 2 : ALTURA
  const LARGURA_BARRA = 46
  const largura = LARGURA_BARRA * 12

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>Resumo de {rotulo}</h2>
          <p>
            {linhas.length} lançamento(s) · {grupos.length}{' '}
            {AGRUPAMENTOS.find((a) => a.chave === agrupar).rotulo.toLowerCase()}(s) · total R$ {brl(total)}
          </p>
        </div>
        <FiltroBotoes
          label="Agrupar por"
          valor={agrupar}
          opcoes={AGRUPAMENTOS.map((a) => ({ valor: a.chave, rotulo: a.rotulo }))}
          onChange={setAgrupar}
          semTodas
        />
      </div>

      <div className="panel-body">
        {/* Gráfico: um mês por barra, com o valor escrito em cima */}
        {/* viewBox no lugar de largura fixa: o desenho acompanha a tela em vez
            de forcar rolagem lateral. */}
        <div style={{ marginBottom: 18 }}>
          <svg
            viewBox={`0 0 ${largura} ${ALTURA + 34}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', height: 'auto', display: 'block', minHeight: 140 }}
            role="img"
            aria-label={`Total por mês de ${rotulo}`}
          >
            <line
              x1="0"
              y1={base}
              x2={largura}
              y2={base}
              stroke="currentColor"
              opacity="0.25"
            />
            {porMes.map((v, i) => {
              const h = (Math.abs(v) / maxAbs) * (temNegativo ? ALTURA / 2 : ALTURA) * 0.88
              const x = i * LARGURA_BARRA
              return (
                <g key={i}>
                  <rect
                    x={x + 8}
                    y={v < 0 ? base : base - h}
                    width={LARGURA_BARRA - 16}
                    height={Math.max(h, v === 0 ? 0 : 1)}
                    rx="2"
                    fill={v < 0 ? 'var(--color-danger, #c0392b)' : 'var(--color-primary, #ff3d03)'}
                    opacity={v === 0 ? 0.12 : 0.85}
                  />
                  <text
                    x={x + LARGURA_BARRA / 2}
                    y={v < 0 ? base + h + 13 : base - h - 5}
                    textAnchor="middle"
                    fontSize="10"
                    fill="currentColor"
                    opacity={v === 0 ? 0.35 : 0.8}
                  >
                    {mil(v)}
                  </text>
                  <text
                    x={x + LARGURA_BARRA / 2}
                    y={ALTURA + 26}
                    textAnchor="middle"
                    fontSize="11"
                    fill="currentColor"
                    opacity="0.6"
                  >
                    {MESES[i]}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* A mesma coisa em número */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{AGRUPAMENTOS.find((a) => a.chave === agrupar).rotulo.toUpperCase()}</th>
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
                      {v === 0 ? '—' : brl(v)}
                    </td>
                  ))}
                  <td className="text-right"><strong>{brl(g.total)}</strong></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td><strong>Total</strong></td>
                {porMes.map((v, i) => (
                  <td key={i} className="text-right" style={{ fontSize: 12 }}>
                    <strong>{v === 0 ? '—' : brl(v)}</strong>
                  </td>
                ))}
                <td className="text-right"><strong>{brl(total)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
