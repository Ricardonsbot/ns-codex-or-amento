import { useUnidade } from './UnidadeProvider'

const umaCasa = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/**
 * Um big number: o nome e, na mesma linha, o valor em destaque e o percentual
 * sobre a receita separados por uma barra. Embaixo, o delta contra o Budget e
 * contra o Last Year — a única parte com cor, porque é a única com sentido de
 * "melhor" ou "pior".
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

function Indicador({ rotulo, valor, pct, vsBudget, vsLy, menorEMelhor, formato }) {
  const { numero } = useUnidade()
  // Contagem não é dinheiro: em "milhões", cinco linhas viravam "0,0".
  const texto = formato === 'inteiro' ? Number(valor ?? 0).toLocaleString('pt-BR') : numero(valor)
  return (
    <div className="indicador">
      <div className="indicador-rotulo">{rotulo}</div>
      <div className="indicador-linha">
        <span className="indicador-valor">{texto}</span>
        {pct !== null && pct !== undefined && isFinite(pct) && (
          <>
            <span className="indicador-barra" aria-hidden="true">|</span>
            <span className="indicador-pct">{umaCasa(pct)}% RoL</span>
          </>
        )}
      </div>
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

