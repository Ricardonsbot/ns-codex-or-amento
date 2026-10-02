import { useUnidade } from './UnidadeProvider'

const umaCasa = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/**
 * Um big number: o nome, o valor em destaque e, embaixo, o percentual sobre a
 * receita numa etiqueta. Por último, o delta contra o Budget e contra o Last
 * Year, verde ou vermelho conforme for melhor ou pior.
 */
function DeltaIndicador({ d, contra, menorEMelhor }) {
  const { numero } = useUnidade()
  if (!d) return null
  const x = d.valor ?? d.pp
  if (x === null || x === undefined || !isFinite(x)) return null
  const bom = menorEMelhor ? x <= 0 : x >= 0
  // Sem "mi"/"mil" ao lado do número: a unidade já está no botão da tela, e
  // repeti-la em sete caixas só fazia volume.
  const texto = d.valor !== undefined ? `${x > 0 ? '+' : ''}${numero(x)}` : `${x > 0 ? '+' : ''}${umaCasa(x)} p.p.`
  return (
    <div className={`indicador-delta ${bom ? 'melhor' : 'pior'}`}>
      {texto} vs {contra}
    </div>
  )
}

/**
 * A família de cada big number, pela chave: dá a cor do filete e da etiqueta
 * de % RoL. São as cores dos módulos que o resto da ferramenta já usa —
 * receita em verde, gasto em vermelho, capex em roxo —, e o EAC em laranja,
 * porque é a linha de chegada. Contagem (linhas, empresas) fica neutra.
 */
const FAMILIA = {
  nr: 'receita',
  gm: 'receita',
  receita: 'receita',
  expenses: 'despesa',
  labor: 'despesa',
  nonLabor: 'despesa',
  despesa: 'despesa',
  capex: 'capex',
  eac: 'resultado',
}

// Com a receita perto de zero o % RoL explode ("102.973.816,5%"): acima
// disso o número não diz nada, e some em vez de ocupar a caixa.
const PCT_COM_SENTIDO = 1000

function Indicador({ chave, rotulo, valor, pct, vsBudget, vsLy, menorEMelhor, formato }) {
  const { numero } = useUnidade()
  // Contagem não é dinheiro: em "milhões", cinco linhas viravam "0,0".
  const texto = formato === 'inteiro' ? Number(valor ?? 0).toLocaleString('pt-BR') : numero(valor)
  const temPct = pct !== null && pct !== undefined && isFinite(pct) && Math.abs(pct) < PCT_COM_SENTIDO
  return (
    <div className={`indicador ${FAMILIA[chave] ?? 'neutro'}`}>
      <div className="indicador-rotulo">{rotulo}</div>
      <div className="indicador-valor">{texto}</div>
      {temPct && <span className="indicador-pct">{umaCasa(pct)}% RoL</span>}
      <DeltaIndicador d={vsBudget} contra="budget" menorEMelhor={menorEMelhor} />
      <DeltaIndicador d={vsLy} contra="LY" menorEMelhor={menorEMelhor} />
    </div>
  )
}

/** A faixa de big numbers, título centralizado sem esticar letra por letra. */
export default function Indicadores({ itens }) {
  return (
    <div className="indicadores">
      {itens.map((i) => (
        <Indicador key={i.chave} {...i} />
      ))}
    </div>
  )
}

