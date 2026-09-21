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

export default function TabelaQuadro({ quadro }) {
  const { grupos, linhas, comIndice } = quadro
  const total = (comIndice ? 1 : 0) + 1 + grupos.reduce((a, g) => a + 1 + g.colunas.length, 0)
  return (
    <div className="rolagem-x">
      <table className={`tabela-xl${comIndice ? '' : ' sem-indice'}`}>
        <thead>
          <tr className="faixa">
            {comIndice && <th className="canto fixa-1" />}
            <th className="canto fixa-2">[ BRL M ]</th>
            {grupos.map((g) => [
              <th key={`v-${g.rotulo}`} className="vao" />,
              <th key={g.rotulo} colSpan={g.colunas.length}>
                {g.rotulo}
              </th>,
            ])}
          </tr>
          <tr className="rotulos">
            {comIndice && <th className="fixa-1" />}
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
          {linhas.map((l, i) => {
            if (l.tipo === 'respiro') {
              return (
                <tr key={`r-${i}`} className="respiro">
                  <td colSpan={total} />
                </tr>
              )
            }
            const recuo = l.nivel !== undefined && l.nivel >= 0 ? { paddingLeft: 6 + l.nivel * 12 } : undefined
            return (
              <tr key={`${l.rotulo}-${i}`} className={CLASSE[l.tipo] ?? ''}>
                {comIndice && <td className="indice fixa-1">{l.indice}</td>}
                <td className="rotulo fixa-2" style={recuo}>
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
