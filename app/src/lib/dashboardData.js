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
