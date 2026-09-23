import { useLayoutEffect, useRef } from 'react'
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

function Indicador({ rotulo, valor, pct, vsBudget, vsLy, menorEMelhor }) {
  const { numero } = useUnidade()
  return (
    <div className="indicador">
      <div className="indicador-rotulo">{rotulo}</div>
      <div className="indicador-linha">
        <span className="indicador-valor">{numero(valor)}</span>
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

/**
 * A faixa de big numbers, com os títulos na largura dos números.
 *
 * Todo título ocupa a mesma largura: a da linha de número mais larga entre as
 * seis caixas (ou a do título mais longo, se ele for maior), pelo espaçamento
 * entre letras. É medida no navegador porque depende da fonte e dos valores.
 */
export default function Indicadores({ itens }) {
  const ref = useRef(null)
  const chave = itens.map((i) => `${i.valor}${i.pct}`).join('|')

  useLayoutEffect(() => {
    const faixa = ref.current
    if (!faixa) return
    const ajustar = () => {
      const titulos = [...faixa.querySelectorAll('.indicador-rotulo')]
      const linhas = [...faixa.querySelectorAll('.indicador-linha')]
      for (const t of titulos) {
        t.style.letterSpacing = '0px'
        t.style.paddingLeft = '0px'
      }
      const natural = titulos.map((t) => t.getBoundingClientRect().width)
      const caixa = faixa.querySelector('.indicador')
      const util = caixa ? caixa.clientWidth - 2 * parseFloat(getComputedStyle(caixa).paddingLeft) : Infinity
      const alvo = Math.min(util, Math.max(...linhas.map((l) => l.getBoundingClientRect().width), ...natural))
      titulos.forEach((t, i) => {
        const letras = t.textContent.length
        const sobra = alvo - natural[i]
        // O espaçamento entra depois de cada letra, inclusive a última; o
        // mesmo tanto à esquerda equilibra, e o texto fica centrado.
        const ls = letras > 1 && sobra > 0 ? sobra / (letras + 1) : 0
        t.style.letterSpacing = `${ls}px`
        t.style.paddingLeft = `${ls}px`
      })
    }
    ajustar()
    const obs = new ResizeObserver(ajustar)
    obs.observe(faixa)
    return () => obs.disconnect()
  }, [chave])

  return (
    <div className="indicadores" ref={ref}>
      {itens.map((i) => (
        <Indicador key={i.chave} {...i} />
      ))}
    </div>
  )
}

