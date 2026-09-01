import { supabase } from './supabaseClient'

export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/**
 * As premissas macro moram nas tabelas `indice` / `indice_valor_mensal` que já
 * existem — não há tabela própria, para não exigir mudança de schema.
 *
 * Consequência: `indice_valor_mensal.percentual` é `numeric(6,3)`, então tudo é
 * guardado com três casas decimais, e não há coluna de unidade. O câmbio é um
 * nível em R$, não uma variação, e se distingue pelo sufixo no nome — é a
 * convenção abaixo. Se um dia a tabela puder ganhar uma coluna `unidade`, é ela
 * que deve substituir esta heurística.
 */
const SUFIXO_NIVEL = '(R$/US$)'

export function unidadeDe(tipo) {
  return tipo.includes(SUFIXO_NIVEL) ? 'reais' : 'percentual'
}

export async function fetchAnos() {
  const { data, error } = await supabase.from('indice').select('ano').order('ano', { ascending: false })
  if (error) throw error
  return [...new Set((data ?? []).map((r) => r.ano))]
}

/**
 * Uma linha por indicador, com os 12 meses posicionados pelo índice (0 = janeiro).
 * O banco guarda um registro por mês; a tela trabalha em matriz.
 */
export async function fetchPremissas(ano) {
  const { data, error } = await supabase
    .from('indice')
    .select('id, tipo, aplicacao, status, indice_valor_mensal(mes, percentual)')
    .eq('ano', ano)
    .order('tipo')
  if (error) throw error

  return (data ?? []).map((i) => {
    const valores = Array(12).fill(null)
    for (const v of i.indice_valor_mensal ?? []) valores[v.mes - 1] = Number(v.percentual)
    return { id: i.id, indicador: i.tipo, unidade: unidadeDe(i.tipo), status: i.status, valores }
  })
}

export async function salvarValor({ indiceId, mes, valor }) {
  const { error } = await supabase
    .from('indice_valor_mensal')
    .upsert({ indice_id: indiceId, mes, percentual: valor }, { onConflict: 'indice_id,mes' })
  if (error) throw error
}

/**
 * Percentual acumula composto no período; um nível em reais não acumula — o que
 * interessa nele é o último mês projetado.
 */
export function acumular(linha) {
  const meses = linha.valores.filter((v) => v !== null)
  if (!meses.length) return null
  if (linha.unidade === 'reais') return meses[meses.length - 1]
  return (meses.reduce((acc, v) => acc * (1 + v / 100), 1) - 1) * 100
}

export function formatar(valor, unidade) {
  if (valor === null || valor === undefined) return '—'
  const opcoes = { minimumFractionDigits: 3, maximumFractionDigits: 3 }
  if (unidade === 'reais') return valor.toLocaleString('pt-BR', opcoes)
  return `${valor.toLocaleString('pt-BR', opcoes)}%`
}
