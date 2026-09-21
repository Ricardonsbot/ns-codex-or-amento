import { useState } from 'react'
import { semaforo } from '../lib/resultadoData'

/**
 * Desenha um quadro de quadrosResultado.js no formato da Master: faixa laranja
 * por grupo com vão branco entre eles, colunas de índice e de nome fixas, e as
 * linhas com a classe do seu tipo (consolidado, BU, torre, subtotal...).
 *
 * Só formata — nenhum número é calculado aqui. O quadro chega em R$ e sai em
 * R$ M com uma casa, como o #,##0.0 da Master.
 */

const CLASSE = {
  consolidado: 'consolidado',
  bu: 'bu',
  torre: 'torre',
  sub: 'sub',
  empresa: '',
  subtotal: 'faixa-soma',
  grupo: 'pai',
  filha: 'subpacote',
  linha: 'detalhe',
  pct: 'detalhe pct',
  alerta: 'alerta',
}

const umaCasa = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** O formato efetivo da célula: linha de margem vira % e o seu ∆, p.p. */
function formatoDe(coluna, linha) {
  const f = coluna.fmt ?? linha.fmt ?? 'mi'
  if (linha.fmt === 'pct' && f === 'mi') return /\.(bd|ld)$/.test(coluna.key) ? 'pp' : 'pct'
  return f
}

function Celula({ valor, fmt, semaforoAtivo }) {
  if (valor === null || valor === undefined || !isFinite(valor)) return <td className="apagado">—</td>
  if (fmt === 'mi') {
    const m = valor / 1e6
    if (Math.abs(m) < 0.05) return <td className="apagado">—</td>
    return <td className="valor">{umaCasa(m)}</td>
  }
  if (fmt === 'pp') return <td>{`${valor > 0 ? '+' : ''}${umaCasa(valor)} p.p.`}</td>
  const cor = semaforoAtivo ? semaforo(valor) : null
  return (
    <td>
      {cor && <span className={`ponto ponto-${cor}`} aria-hidden="true" />}
      {umaCasa(valor)}%
    </td>
  )
}

/**
 * Níveis do agrupamento, como os botões 1 2 3 4 do Excel: 1 mostra só as BUs,
 * 2 abre até as torres, 3 até as sub torres e 4 até as empresas.
 */
const NIVEIS = [
  { n: 1, titulo: 'Só BUs' },
  { n: 2, titulo: 'Até torres' },
  { n: 3, titulo: 'Até sub torres' },
  { n: 4, titulo: 'Até empresas' },
]

/**
 * Quais linhas da árvore aparecem. Uma linha está aberta (mostra os filhos)
 * quando o botão +/− dela diz isso; sem clique, vale o nível escolhido. Ela
 * aparece se todos os ancestrais estiverem abertos. A chave é o índice do
 * caminho (1, 1.2, 1.2.3), que não aparece mais na tela mas continua único.
 */
function visiveis(linhas, nivelMax, excecoes) {
  const aberta = (l) => (excecoes.has(l.indice) ? excecoes.get(l.indice) : l.nivel + 1 < nivelMax)
  const saida = []
  const pilha = [] // ancestrais da linha atual: { nivel, aberta }
  for (const l of linhas) {
    if (l.nivel === undefined || l.nivel < 0) {
      pilha.length = 0
      saida.push(l)
      continue
    }
    while (pilha.length && pilha[pilha.length - 1].nivel >= l.nivel) pilha.pop()
    if (pilha.every((a) => a.aberta)) saida.push(l)
    pilha.push({ nivel: l.nivel, aberta: aberta(l) })
  }
  return { saida, aberta }
}

export default function TabelaQuadro({ quadro }) {
  const { grupos, linhas } = quadro
  // Quadro por estrutura (BU → Torre → Sub Torre → Empresa) ganha o
  // agrupamento; os demais são tabelas corridas.
  const arvore = Boolean(quadro.comIndice)
  const [nivelMax, setNivelMax] = useState(4)
  const [excecoes, setExcecoes] = useState(() => new Map())

  const total = 1 + grupos.reduce((a, g) => a + 1 + g.colunas.length, 0)
  const { saida, aberta } = arvore ? visiveis(linhas, nivelMax, excecoes) : { saida: linhas, aberta: () => false }
  const temFilhos = (i) => {
    const l = saida[i]
    const idx = linhas.indexOf(l)
    const prox = linhas[idx + 1]
    return arvore && l.nivel >= 0 && prox && prox.nivel > l.nivel
  }
  const alternar = (l) =>
    setExcecoes((m) => {
      const novo = new Map(m)
      novo.set(l.indice, !aberta(l))
      return novo
    })
  const escolherNivel = (n) => {
    setNivelMax(n)
    // Como no Excel: o botão de nível desfaz os +/− avulsos.
    setExcecoes(new Map())
  }

  return (
    <div className="rolagem-x">
      <table className="tabela-xl sem-indice">
        <thead>
          <tr className="faixa">
            <th className="canto fixa-2">
              {arvore ? (
                <span className="agrupar-niveis" role="group" aria-label="Nível de agrupamento">
                  {NIVEIS.map((x) => (
                    <button
                      key={x.n}
                      type="button"
                      title={x.titulo}
                      className={nivelMax === x.n && !excecoes.size ? 'ativo' : undefined}
                      onClick={() => escolherNivel(x.n)}
                    >
                      {x.n}
                    </button>
                  ))}
                  <span className="agrupar-unidade">[ BRL M ]</span>
                </span>
              ) : (
                '[ BRL M ]'
              )}
            </th>
            {grupos.map((g) => [
              <th key={`v-${g.rotulo}`} className="vao" />,
              <th key={g.rotulo} colSpan={g.colunas.length}>
                {g.rotulo}
              </th>,
            ])}
          </tr>
          <tr className="rotulos">
            <th className="rotulo fixa-2" />
            {grupos.map((g) => [
              <th key={`v-${g.rotulo}`} className="vao" />,
              ...g.colunas.map((c) => (
                <th key={c.key} className={c.papel ?? undefined}>
                  {c.label}
                </th>
              )),
            ])}
          </tr>
        </thead>
        <tbody>
          {saida.map((l, i) => {
            if (l.tipo === 'respiro') {
              return (
                <tr key={`r-${i}`} className="respiro">
                  <td colSpan={total} />
                </tr>
              )
            }
            const nivel = l.nivel !== undefined && l.nivel >= 0 ? l.nivel : null
            const filhos = temFilhos(i)
            // A folha (empresa) recua o espaço do botão, para o nome alinhar
            // com os irmãos que têm +/−.
            const recuo = nivel !== null ? { paddingLeft: 6 + nivel * 14 + (filhos || !arvore ? 0 : 20) } : undefined
            return (
              <tr key={`${l.indice ?? l.rotulo}-${i}`} className={CLASSE[l.tipo] ?? ''}>
                <td className="rotulo fixa-2" style={recuo}>
                  {filhos && (
                    <button
                      type="button"
                      className="agrupar-botao"
                      aria-expanded={aberta(l)}
                      aria-label={`${aberta(l) ? 'Recolher' : 'Expandir'} ${l.rotulo}`}
                      onClick={() => alternar(l)}
                    >
                      {aberta(l) ? '−' : '+'}
                    </button>
                  )}
                  {l.rotulo}
                </td>
                {grupos.map((g) => [
                  <td key={`v-${g.rotulo}`} className="vao" />,
                  ...g.colunas.map((c) => (
                    <Celula key={c.key} valor={l.v?.[c.key]} fmt={formatoDe(c, l)} semaforoAtivo={c.semaforo} />
                  )),
                ])}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
