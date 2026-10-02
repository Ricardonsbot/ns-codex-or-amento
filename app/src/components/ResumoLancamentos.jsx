import { useMemo, useState } from 'react'
import { montarDrill, caminhoDoDrill } from '../lib/drillResumo'
import { useUnidade } from './UnidadeProvider'
import BotaoRecolher from './BotaoRecolher'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const mil = (v) =>
  Math.abs(v) >= 1000
    ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`
    : v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })

/**
 * Resumo do que está lançado: os doze meses em gráfico e a mesma coisa aberta
 * em tabela, da linha do P&L até o lançamento (ver drillResumo.js). Era uma
 * linha por conta, chapada: para chegar no centro de custo que pesava numa
 * conta era preciso exportar e abrir no Excel.
 *
 * Não calcula nada além de somar. O que aparece aqui é exatamente o que está
 * gravado — se veio da importação, é o que a planilha trouxe.
 */
/**
 * Uma linha da árvore e, se aberta, as de baixo. A folha é o lançamento: não
 * abre, e é o número exatamente como foi gravado. Nó com centenas de
 * lançamentos mostra os maiores primeiro e o resto sob demanda — abrir mil
 * linhas de uma vez travava a tabela.
 */
const FOLHAS_DE_UMA_VEZ = 50

function LinhaDrill({ no, abertos, alternar, numero }) {
  const [todas, setTodas] = useState(false)
  const folha = no.dimensao === 'Lançamento'
  const aberto = !folha && abertos.has(no.chave)
  const folhas = aberto ? (todas ? no.folhas : no.folhas.slice(0, FOLHAS_DE_UMA_VEZ)) : []
  const recuo = { paddingLeft: 12 + no.nivel * 18 }

  return (
    <>
      <tr
        className={`drill-linha nivel-${Math.min(no.nivel, 3)}${folha ? ' folha' : ''}${aberto ? ' aberta' : ''}`}
        onClick={folha ? undefined : () => alternar(no.chave)}
      >
        <td style={recuo} title={`${no.dimensao}: ${no.rotulo}`}>
          {folha ? (
            <span className="drill-seta" aria-hidden="true" />
          ) : (
            <button
              type="button"
              className="drill-seta"
              aria-expanded={aberto}
              aria-label={`${aberto ? 'Fechar' : 'Abrir'} ${no.rotulo}`}
              onClick={(e) => {
                e.stopPropagation()
                alternar(no.chave)
              }}
            >
              {aberto ? '▾' : '▸'}
            </button>
          )}
          <span className="drill-rotulo">{no.rotulo}</span>
          {!folha && (
            <span className="drill-dim">
              {no.dimensao} · {no.lancamentos}
            </span>
          )}
        </td>
        {no.valores.map((v, i) => (
          <td key={i} className="text-right" style={{ opacity: v === 0 ? 0.3 : 1 }}>
            {v === 0 ? '—' : numero(v)}
          </td>
        ))}
        <td className="text-right drill-total">{numero(no.total)}</td>
      </tr>
      {aberto &&
        no.filhos.map((f) => <LinhaDrill key={f.chave} no={f} abertos={abertos} alternar={alternar} numero={numero} />)}
      {folhas.map((f) => (
        <LinhaDrill key={f.chave} no={f} abertos={abertos} alternar={alternar} numero={numero} />
      ))}
      {aberto && !todas && no.folhas.length > FOLHAS_DE_UMA_VEZ && (
        <tr className="drill-mais">
          <td colSpan={14} style={{ paddingLeft: 12 + (no.nivel + 1) * 18 }}>
            <button type="button" className="drill-mais-botao" onClick={() => setTodas(true)}>
              Mostrar os outros {no.folhas.length - FOLHAS_DE_UMA_VEZ} lançamento(s)
            </button>
          </td>
        </tr>
      )}
    </>
  )
}

export default function ResumoLancamentos({ linhas, rotulo, tipo = 'despesa', empresas }) {
  const { numero, comMoeda } = useUnidade()

  const [abertos, setAbertos] = useState(() => new Set())

  const { arvore, porMes, total, contas } = useMemo(() => {
    const nomes = new Map((empresas ?? []).map((e) => [e.id, e.nome]))
    const arvore = montarDrill(linhas, tipo, (id) => nomes.get(id))
    const porMes = Array(12).fill(0)
    for (const no of arvore) no.valores.forEach((v, i) => (porMes[i] += v))
    const contas = new Set(linhas.map((l) => l.conta_id ?? 'sem')).size
    return { arvore, porMes, total: porMes.reduce((a, b) => a + b, 0), contas }
  }, [linhas, tipo, empresas])

  // As chaves são o caminho ("(-) G&A›Facilities›…"), não posições: trocar
  // o recorte ou salvar uma linha da grade mantém aberto o que ainda existe,
  // e o que sumiu simplesmente não casa com nada.
  const alternar = (chave) =>
    setAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })

  /** Abre o nível seguinte ao mais fundo que já está aberto em toda parte. */
  function abrirUmNivel() {
    const novo = new Set(abertos)
    const descer = (nos) => {
      for (const no of nos) {
        if (!novo.has(no.chave)) novo.add(no.chave)
        else descer(no.filhos)
      }
    }
    descer(arvore)
    setAbertos(novo)
  }

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
        <BotaoRecolher chave="resumo-lancamentos-1" />
        <div>
          <h2>Resumo de {rotulo}</h2>
          <p>
            {linhas.length} lançamento(s) · {contas} conta(s) · total {comMoeda(total)} · clique numa linha
            para abrir
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

        {/* A mesma coisa em número, aberta como árvore: da linha do P&L até
            o lançamento. Cada clique desce um nível; com muitas linhas a
            tabela tem altura própria e rola dentro do painel. */}
        <div className="drill-acoes">
          <span className="drill-caminho">{caminhoDoDrill(tipo).join(' › ')}</span>
          <button className="btn btn-ghost btn-sm" type="button" onClick={abrirUmNivel}>
            Abrir um nível
          </button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setAbertos(new Set())} disabled={!abertos.size}>
            Recolher tudo
          </button>
        </div>
        <div className="resumo-contas-scroll">
          <table className="data-table tabela-drill">
            <thead>
              <tr>
                <th>LINHA DO P&amp;L</th>
                {MESES.map((m) => (
                  <th key={m} className="text-right">{m.toUpperCase()}</th>
                ))}
                <th className="text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {arvore.map((no) => (
                <LinhaDrill key={no.chave} no={no} abertos={abertos} alternar={alternar} numero={numero} />
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
