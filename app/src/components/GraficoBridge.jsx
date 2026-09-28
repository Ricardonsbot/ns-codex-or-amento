import { useUnidade } from './UnidadeProvider'

/**
 * A cascata da bridge, no formato que o time usa no Farol: as duas pontas em
 * barra cinza cheia, cada variação como uma caixinha flutuante verde ou
 * vermelha, o fio pontilhado ligando um degrau ao outro, e o salto total num
 * selo em cima.
 *
 * `cascata` é { inicio, degraus, fim }, cada um { rotulo, valor }; o valor dos
 * degraus é a variação, com sinal. Um degrau marcado `tipo: 'total'` não é
 * variação: é um subtotal que reabre a conta no chão — o EBITDA no meio da
 * ponte Revenue → EBITDA after Capex —, e por isso vira barra cheia como as
 * pontas, e os degraus seguintes partem dele.
 *
 * A escala é cortada de propósito quando todas as pontas estão longe do zero
 * — é o que deixa os degraus legíveis em vez de virarem riscos no topo de
 * duas barras gigantes. O corte é declarado no desenho, com a marca de
 * quebra no pé das barras cinzas; sem ela o gráfico mentiria sobre a
 * proporção.
 */
const ALTURA = 230
const TOPO = 58
const RODAPE = 58
const PASSO = 112
const BARRA = 58
const ALTURA_MINIMA_CAIXA = 22

/** Quebra o rótulo em linhas curtas, para caber embaixo da coluna. */
function emLinhas(rotulo, limite = 14) {
  const palavras = String(rotulo).replace(/ · /g, ' ').split(' ')
  const linhas = []
  let atual = ''
  for (const p of palavras) {
    if (!atual) atual = p
    else if (`${atual} ${p}`.length <= limite) atual += ` ${p}`
    else {
      linhas.push(atual)
      atual = p
    }
  }
  if (atual) linhas.push(atual)
  return linhas.slice(0, 3)
}

export default function GraficoBridge({ cascata, titulo, moldura = true }) {
  const { numero, u } = useUnidade()
  if (!cascata?.degraus?.length) return null

  const { inicio, degraus, fim } = cascata

  // Onde cada barra começa e termina: cada degrau parte de onde o anterior parou.
  const barras = [
    { rotulo: inicio.rotulo, de: 0, ate: inicio.valor, valor: inicio.valor, tipo: 'total' },
    ...degraus.reduce((acc, d) => {
      const de = acc.length ? acc[acc.length - 1].ate : inicio.valor
      if (d.tipo === 'total') acc.push({ rotulo: d.rotulo, de: 0, ate: d.valor, valor: d.valor, tipo: 'total' })
      else acc.push({ rotulo: d.rotulo, de, ate: de + d.valor, valor: d.valor, tipo: d.valor >= 0 ? 'sobe' : 'desce' })
      return acc
    }, []),
    { rotulo: fim.rotulo, de: 0, ate: fim.valor, valor: fim.valor, tipo: 'total' },
  ]

  // Os extremos do que precisa aparecer — o zero das barras de ponta não
  // conta, senão a escala volta a nascer nele.
  const pontos = barras.flatMap((b) => (b.tipo === 'total' ? [b.ate] : [b.de, b.ate]))
  const maior = Math.max(...pontos)
  const menor = Math.min(...pontos)
  const faixa = maior - menor || Math.abs(maior) || 1

  // Só corta a escala quando tudo está do mesmo lado do zero, longe dele, e o
  // corte ainda sobra acima do zero — numa ponte que vai de 490 a 189 o corte
  // cairia abaixo do zero, e aí ele não é corte nenhum.
  const pisoCortado = menor - faixa * 1.1
  const cortada = menor > 0 && menor > faixa * 0.6 && pisoCortado > 0
  const piso = cortada ? pisoCortado : Math.min(0, menor)
  const teto = maior + faixa * 0.18

  const escala = (v) => TOPO + ALTURA - ((v - piso) / (teto - piso || 1)) * ALTURA
  const largura = PASSO * barras.length
  const x = (i) => i * PASSO + (PASSO - BARRA) / 2
  const meio = (i) => x(i) + BARRA / 2
  const base = escala(piso)

  const salto = fim.valor - inicio.valor
  const textoSalto = `${salto >= 0 ? '+' : '−'}${numero(Math.abs(salto))}`
  // O selo acompanha o número: com 68 fixos, "−1.234,5" transbordava.
  const larguraSelo = Math.max(60, textoSalto.length * 8 + 22)
  const yArco = TOPO - 18
  const ultimo = barras.length - 1

  return (
    <div className={moldura ? 'grafico-bridge' : 'grafico-bridge sem-moldura'}>
      <svg
        viewBox={`0 0 ${largura} ${TOPO + ALTURA + RODAPE}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={titulo ? `Cascata: ${titulo}` : 'Cascata da bridge'}
      >
        {titulo && (
          <text className="bridge-titulo" x={largura / 2} y="18" textAnchor="middle">
            {titulo}
          </text>
        )}

        {/* O arco do salto total: sai do topo da primeira ponta e desce na
            última, com o selo do número no meio. */}
        <g className="bridge-arco">
          <path
            d={`M${meio(0)} ${escala(inicio.valor) - 8} V${yArco} H${meio(ultimo)} V${escala(fim.valor) - 14}`}
            fill="none"
          />
          <path d={`M${meio(ultimo) - 4} ${escala(fim.valor) - 18} L${meio(ultimo)} ${escala(fim.valor) - 11} L${meio(ultimo) + 4} ${escala(fim.valor) - 18}`} fill="none" />
        </g>
        <g className={`bridge-selo ${salto >= 0 ? 'sobe' : 'desce'}`}>
          <rect x={largura / 2 - larguraSelo / 2} y={yArco - 11} width={larguraSelo} height="22" rx="11" />
          <text x={largura / 2} y={yArco + 4} textAnchor="middle">
            {textoSalto}
          </text>
        </g>

        {barras.map((b, i) => {
          const anterior = barras[i - 1]
          const topo = escala(Math.max(b.de, b.ate))
          const fundo = b.tipo === 'total' ? base : escala(Math.min(b.de, b.ate))
          // Caixa curta demais para o número: cresce para baixo o mínimo
          // necessário, sem mexer no topo, que é o que o degrau significa.
          const alturaCaixa = Math.max(fundo - topo, b.tipo === 'total' ? 2 : ALTURA_MINIMA_CAIXA)

          return (
            <g key={`${b.rotulo}-${i}`}>
              {anterior && (
                <line
                  className="bridge-fio"
                  x1={x(i - 1)}
                  y1={escala(anterior.ate)}
                  x2={x(i) + BARRA}
                  y2={escala(anterior.ate)}
                />
              )}

              <rect className={`barra-${b.tipo}`} x={x(i)} y={topo} width={BARRA} height={alturaCaixa} />

              {/* Marca de quebra: diz que a barra não começa no zero. */}
              {b.tipo === 'total' && cortada && (
                <g className="bridge-quebra">
                  <rect x={x(i) - 3} y={base - 26} width={BARRA + 6} height="12" className="bridge-quebra-vao" />
                  <path d={`M${x(i) - 3} ${base - 14} L${x(i) + BARRA + 3} ${base - 22}`} />
                  <path d={`M${x(i) - 3} ${base - 18} L${x(i) + BARRA + 3} ${base - 26}`} />
                </g>
              )}

              {b.tipo === 'total' ? (
                <text className="bridge-valor-total" x={meio(i)} y={topo - 8} textAnchor="middle">
                  {numero(b.valor)}
                </text>
              ) : (
                <text
                  className={`bridge-valor-degrau ${b.tipo}`}
                  x={meio(i)}
                  y={topo + alturaCaixa / 2 + 4}
                  textAnchor="middle"
                >
                  {numero(Math.abs(b.valor))}
                </text>
              )}

              {emLinhas(b.rotulo).map((linha, j) => (
                <text
                  key={j}
                  className={`bridge-rotulo${b.tipo === 'total' ? ' ponta' : ''}`}
                  x={meio(i)}
                  y={TOPO + ALTURA + 18 + j * 12}
                  textAnchor="middle"
                >
                  {linha}
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
