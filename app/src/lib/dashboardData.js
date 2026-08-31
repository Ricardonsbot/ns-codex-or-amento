import { supabase } from './supabaseClient'

export async function fetchAnos() {
  const { data, error } = await supabase.from('ciclo').select('ano').order('ano', { ascending: false })
  if (error) throw error
  return (data ?? []).map((c) => c.ano)
}

export async function fetchBUs() {
  const { data, error } = await supabase.from('bu').select('id, nome').order('nome')
  if (error) throw error
  return data ?? []
}

export async function fetchTorres() {
  const { data, error } = await supabase.from('torre').select('id, nome, bu_id').order('nome')
  if (error) throw error
  return data ?? []
}

export async function fetchEmpresas() {
  const { data, error } = await supabase.from('empresa').select('id, nome, bu_id, torre_id').order('nome')
  if (error) throw error
  return data ?? []
}

export async function fetchBridgeSummary({ ano, buId, torreId }) {
  const zero = { receita: 0, despesa: 0, capex: 0 }
  if (!ano) return zero

  const { data: ciclo, error: cicloError } = await supabase
    .from('ciclo')
    .select('id')
    .eq('ano', ano)
    .maybeSingle()
  if (cicloError) throw cicloError
  if (!ciclo) return zero

  const { data: versoes, error: versaoError } = await supabase
    .from('versao')
    .select('id')
    .eq('ciclo_id', ciclo.id)
  if (versaoError) throw versaoError
  const versaoIds = (versoes ?? []).map((v) => v.id)
  if (versaoIds.length === 0) return zero

  let query = supabase
    .from('lancamento')
    .select('tipo, lancamento_valor_mensal(valor)')
    .in('versao_id', versaoIds)
  if (buId) query = query.eq('bu_id', buId)
  if (torreId) query = query.eq('torre_id', torreId)

  const { data: lancamentos, error: lancamentoError } = await query
  if (lancamentoError) throw lancamentoError

  const totals = { receita: 0, despesa: 0, capex: 0 }
  for (const l of lancamentos ?? []) {
    const soma = (l.lancamento_valor_mensal ?? []).reduce((acc, v) => acc + Number(v.valor), 0)
    if (totals[l.tipo] !== undefined) totals[l.tipo] += soma
  }

  return {
    receita: totals.receita / 1_000_000,
    despesa: totals.despesa / 1_000_000,
    capex: totals.capex / 1_000_000,
  }
}

export function computeBridge({ receita, despesa, capex }) {
  const ebitda = receita - despesa
  const ebitdaAfterCapex = ebitda - capex
  const scale = Math.max(Math.abs(receita), Math.abs(ebitda), Math.abs(ebitdaAfterCapex), 1)
  const pct = (v) => Math.min(100, Math.max(0, (Math.abs(v) / scale) * 100))

  return {
    receita,
    despesa,
    capex,
    ebitda,
    ebitdaAfterCapex,
    bars: {
      receita: { bottom: 0, height: pct(receita) },
      despesa: { bottom: pct(ebitda), height: pct(despesa) },
      ebitda: { bottom: 0, height: pct(ebitda) },
      capex: { bottom: pct(ebitdaAfterCapex), height: pct(capex) },
      ebitdaAfterCapex: { bottom: 0, height: pct(ebitdaAfterCapex) },
    },
  }
}

export function formatMi(valor) {
  const sinal = valor < 0 ? '− ' : ''
  const numero = Math.abs(valor).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${sinal}R$ ${numero} mi`
}
