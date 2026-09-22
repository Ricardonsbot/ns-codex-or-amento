import { createContext, useContext, useMemo, useState } from 'react'

/**
 * A unidade em que os valores aparecem: milhões (padrão, como a Master) ou
 * milhares. Vale para o app inteiro — Dashboard, Resultado, Relatórios,
 * grades de lançamento e histórico de importação — para que o mesmo número
 * não apareça em duas escalas em telas vizinhas.
 *
 * É escolha de quem está olhando, não dado do orçamento: fica no navegador.
 * O que é gravado e exportado continua em R$ cheios, sem escala nenhuma.
 */

export const UNIDADES = {
  mi: { valor: 'mi', divisor: 1e6, sufixo: 'mi', rotuloCurto: 'R$ M', faixa: '[ BRL M ]', casas: 1 },
  mil: { valor: 'mil', divisor: 1e3, sufixo: 'mil', rotuloCurto: 'R$ mil', faixa: '[ BRL mil ]', casas: 1 },
}

const CHAVE = 'ns-budget:unidade'
const UnidadeContext = createContext(null)

function lerSalva() {
  try {
    const v = localStorage.getItem(CHAVE)
    return UNIDADES[v] ? v : 'mi'
  } catch {
    return 'mi'
  }
}

export default function UnidadeProvider({ children }) {
  const [unidade, setUnidadeEstado] = useState(lerSalva)

  const valor = useMemo(() => {
    const u = UNIDADES[unidade] ?? UNIDADES.mi
    const numero = (v) =>
      (Number(v ?? 0) / u.divisor).toLocaleString('pt-BR', {
        minimumFractionDigits: u.casas,
        maximumFractionDigits: u.casas,
      })
    return {
      unidade,
      u,
      setUnidade: (nova) => {
        if (!UNIDADES[nova]) return
        try {
          localStorage.setItem(CHAVE, nova)
        } catch {
          // navegador sem armazenamento: a escolha só não sobrevive ao reload
        }
        setUnidadeEstado(nova)
      },
      /** Só o número, como nas tabelas da Master ("1.234,5"). */
      numero,
      /** Número com moeda e unidade ("R$ 1.234,5 mi"). */
      comMoeda: (v) => {
        const n = Number(v ?? 0)
        return `${n < 0 ? '− ' : ''}R$ ${numero(Math.abs(n))} ${u.sufixo}`
      },
      /** Abaixo de meia casa a célula vira "—" em vez de mostrar 0,0. */
      desprezivel: (v) => Math.abs(Number(v ?? 0)) < u.divisor * 0.05,
    }
  }, [unidade])

  return <UnidadeContext.Provider value={valor}>{children}</UnidadeContext.Provider>
}

export function useUnidade() {
  // Fora do provider (um teste, um render isolado) vale o padrão em milhões,
  // em vez de quebrar a tela inteira.
  return useContext(UnidadeContext) ?? semProvider
}

const u = UNIDADES.mi
const numeroPadrao = (v) =>
  (Number(v ?? 0) / u.divisor).toLocaleString('pt-BR', { minimumFractionDigits: u.casas, maximumFractionDigits: u.casas })
const semProvider = {
  unidade: 'mi',
  u,
  setUnidade: () => {},
  numero: numeroPadrao,
  comMoeda: (v) => `${Number(v ?? 0) < 0 ? '− ' : ''}R$ ${numeroPadrao(Math.abs(Number(v ?? 0)))} ${u.sufixo}`,
  desprezivel: (v) => Math.abs(Number(v ?? 0)) < u.divisor * 0.05,
}
