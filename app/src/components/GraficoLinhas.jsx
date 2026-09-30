import { useState } from 'react'
import { useUnidade } from './UnidadeProvider'

/**
 * Séries mensais em linha: o mês no eixo horizontal, o valor no vertical.
 *
 * As cores das séries não são as da interface. O verde e o vermelho que a
 * ferramenta usa em Receita e Despesa ficam a ΔE 5,5 um do outro para quem
 * tem deuteranopia — as duas linhas viram a mesma cor. Aqui a despesa é um
 * vermelho mais escuro e alaranjado, que separa das outras duas em todas as
 * formas de daltonismo (pior par a ΔE 9,6). Além da cor, cada linha é
 * nomeada na legenda e no fim da própria linha: quem não distingue a cor
 * ainda lê qual é qual.
 *
 * `series` é [{ id, rotulo, cor, valores: number[12] }].
 */
const LARGURA = 720
const ALTURA = 210
const ESQUERDA = 46 // o eixo de valores
const DIREITA = 96 // sobra para o nome no fim da linha
const TOPO = 12
const RODAPE = 26

/** Uma escala redonda que contém os dados, com o zero sempre dentro. */
function escalaDe(valores) {
  const maior = Math.max(0, ...valores)
  const menor = Math.min(0, ...valores)
  const faixa = maior - menor || Math.abs(maior) || 1
  const passo = Math.pow(10, Math.floor(Math.log10(faixa / 3)))
  const arredondar = (v, cima) => (cima ? Math.ceil(v / passo) : Math.floor(v / passo)) * passo
  return { teto: arredondar(maior + faixa * 0.08, true), piso: arredondar(menor, false) }
}

export default function GraficoLinhas({ series, rotulos, titulo, subtitulo }) {
  const { numero, u } = useUnidade()
  const [mes, setMes] = useState(null)

  const comDado = (series ?? []).filter((s) => s.valores?.some((v) => v))
  if (!comDado.length) return null

  const { teto, piso } = escalaDe(comDado.flatMap((s) => s.valores))
  const largura = LARGURA - ESQUERDA - DIREITA
  const altura = ALTURA - TOPO - RODAPE
  const x = (i) => ESQUERDA + (rotulos.length > 1 ? (i / (rotulos.length - 1)) * largura : largura / 2)
  const y = (v) => TOPO + altura - ((v - piso) / (teto - piso || 1)) * altura

  // Quatro marcas no eixo: mais que isso vira grade, e a grade compete com
  // as linhas pela atenção.
  const marcas = [0, 1, 2, 3].map((k) => piso + ((teto - piso) * k) / 3)

  /** De onde o mouse está para o mês mais perto. */
  function aoMover(e) {
    const caixa = e.currentTarget.getBoundingClientRect()
    const fracao = (e.clientX - caixa.left) / caixa.width
    const dentro = (fracao * LARGURA - ESQUERDA) / largura
    setMes(Math.max(0, Math.min(rotulos.length - 1, Math.round(dentro * (rotulos.length - 1)))))
  }

  return (
    <div className="grafico-linhas">
      {titulo && (
        <div className="grafico-linhas-topo">
          <div>
            <strong>{titulo}</strong>
            {subtitulo && <span>{subtitulo}</span>}
          </div>
          <ul className="grafico-legenda">
            {comDado.map((s) => (
              <li key={s.id}>
                <span className="legenda-marca" style={{ background: s.cor }} aria-hidden="true" />
                {s.rotulo}
              </li>
            ))}
          </ul>
        </div>
      )}

      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        preserveAspectRatio="xMidYMid meet"
        className="grafico-linhas-svg"
        role="img"
        aria-label={`${titulo ?? 'Séries mensais'}: ${comDado.map((s) => s.rotulo).join(', ')}`}
        onMouseMove={aoMover}
        onMouseLeave={() => setMes(null)}
      >
        {marcas.map((v) => (
          <g key={v}>
            <line className="grafico-grade" x1={ESQUERDA} y1={y(v)} x2={ESQUERDA + largura} y2={y(v)} />
            <text className="grafico-marca" x={ESQUERDA - 8} y={y(v) + 4} textAnchor="end">
              {numero(v)}
            </text>
          </g>
        ))}

        {mes !== null && (
          <line className="grafico-cruz" x1={x(mes)} y1={TOPO} x2={x(mes)} y2={TOPO + altura} />
        )}

        {comDado.map((s) => (
          <g key={s.id}>
            <path
              className="grafico-linha"
              stroke={s.cor}
              d={s.valores.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(' ')}
            />
            {s.valores.map((v, i) => (
              <circle
                key={i}
                className={`grafico-ponto${mes === i ? ' ativo' : ''}`}
                cx={x(i)}
                cy={y(v)}
                r={mes === i ? 5 : 4}
                fill={s.cor}
              />
            ))}
            {/* O nome no fim da linha: identidade que não depende da cor. */}
            <text
              className="grafico-nome"
              x={ESQUERDA + largura + 6}
              y={y(s.valores[s.valores.length - 1]) + 4}
              fill={s.cor}
            >
              {s.rotulo}
            </text>
          </g>
        ))}

        {rotulos.map((r, i) => (
          <text key={r} className={`grafico-mes${mes === i ? ' ativo' : ''}`} x={x(i)} y={ALTURA - 8} textAnchor="middle">
            {r}
          </text>
        ))}
      </svg>

      {mes !== null && (
        <div
          className="grafico-tooltip"
          style={{ left: `${(x(mes) / LARGURA) * 100}%` }}
          role="status"
        >
          <strong>{rotulos[mes]}</strong>
          {comDado.map((s) => (
            <span key={s.id}>
              <span className="legenda-marca" style={{ background: s.cor }} aria-hidden="true" />
              {s.rotulo}
              <b>{numero(s.valores[mes])}</b>
            </span>
          ))}
        </div>
      )}

      <div className="grafico-linhas-unidade">{u.faixa}</div>
    </div>
  )
}
