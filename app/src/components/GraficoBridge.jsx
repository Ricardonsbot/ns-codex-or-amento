import { useUnidade } from './UnidadeProvider'

/**
 * A cascata da Bridge de Receita: a barra do Budget, um degrau por variação e
 * a barra da versão atual. Cada degrau começa onde o anterior parou, e o fio
 * pontilhado liga um ao outro — é o que faz ler como ponte, e não como sete
 * barras soltas.
 *
 * `cascata` é { inicio, degraus, fim }, cada um { rotulo, valor }; o valor dos
 * degraus é a variação, com sinal.
 */
const ALTURA = 210
const PASSO = 128
const LARGURA_BARRA = 66

export default function GraficoBridge({ cascata }) {
  const { numero, u } = useUnidade()
  if (!cascata?.degraus?.length) return null

  const { inicio, degraus, fim } = cascata

  // Onde cada barra começa e termina: cada degrau parte de onde o anterior parou.
  const barras = [
    { rotulo: inicio.rotulo, de: 0, ate: inicio.valor, valor: inicio.valor, tipo: 'total' },
    ...degraus.reduce((acc, d) => {
      const de = acc.length ? acc[acc.length - 1].ate : inicio.valor
      acc.push({ rotulo: d.rotulo, de, ate: de + d.valor, valor: d.valor, tipo: d.valor >= 0 ? 'sobe' : 'desce' })
      return acc
    }, []),
    { rotulo: fim.rotulo, de: 0, ate: fim.valor, valor: fim.valor, tipo: 'total' },
  ]

  const teto = Math.max(...barras.flatMap((b) => [b.de, b.ate]), 0)
  const piso = Math.min(...barras.flatMap((b) => [b.de, b.ate]), 0)
  const escala = (v) => ALTURA - ((v - piso) / (teto - piso || 1)) * ALTURA
  const largura = PASSO * barras.length
  const x = (i) => i * PASSO + (PASSO - LARGURA_BARRA) / 2

  return (
    <div className="grafico-bridge">
      <svg
        viewBox={`0 0 ${largura} ${ALTURA + 62}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="Cascata da bridge de receita"
      >
        <line x1="0" y1={escala(0)} x2={largura} y2={escala(0)} stroke="currentColor" opacity="0.25" />

        {barras.map((b, i) => {
          const topo = escala(Math.max(b.de, b.ate))
          const alturaBarra = Math.max(Math.abs(escala(b.de) - escala(b.ate)), 2)
          const anterior = barras[i - 1]
          return (
            <g key={`${b.rotulo}-${i}`}>
              {anterior && (
                <line
                  x1={x(i - 1)}
                  y1={escala(anterior.ate)}
                  x2={x(i) + LARGURA_BARRA}
                  y2={escala(anterior.ate)}
                  stroke="currentColor"
                  strokeDasharray="3 3"
                  opacity="0.35"
                />
              )}
              <rect x={x(i)} y={topo} width={LARGURA_BARRA} height={alturaBarra} rx="2" className={`barra-${b.tipo}`} />
              <text x={x(i) + LARGURA_BARRA / 2} y={topo - 7} textAnchor="middle" fontSize="12" fill="currentColor">
                {b.tipo === 'total' ? numero(b.valor) : `${b.valor > 0 ? '+' : ''}${numero(b.valor)}`}
              </text>
              {/* O rótulo quebra em duas linhas: "(+) Novo", "Cliente · Produto". */}
              {b.rotulo.split(' · ').map((parte, j) => (
                <text
                  key={j}
                  x={x(i) + LARGURA_BARRA / 2}
                  y={ALTURA + 20 + j * 14}
                  textAnchor="middle"
                  fontSize="11"
                  fill="currentColor"
                  opacity="0.7"
                >
                  {parte.length > 20 ? `${parte.slice(0, 19)}…` : parte}
                </text>
              ))}
            </g>
          )
        })}
      </svg>
      <div className="grafico-bridge-unidade">{u.faixa}</div>
    </div>
  )
}
