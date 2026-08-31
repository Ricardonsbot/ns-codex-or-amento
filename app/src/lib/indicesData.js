import { supabase } from './supabaseClient'

export async function fetchIndices() {
  const { data, error } = await supabase
    .from('indice')
    .select('*, indice_valor_mensal(percentual)')
    .order('ano', { ascending: false })
    .order('tipo')
  if (error) throw error
  return (data ?? []).map((i) => ({
    ...i,
    acumulado: (i.indice_valor_mensal ?? []).reduce((acc, v) => acc + Number(v.percentual), 0),
  }))
}

export async function createIndice({ tipo, aplicacao, ano, status }) {
  const { data, error } = await supabase.from('indice').insert({ tipo, aplicacao, ano, status }).select().single()
  if (error) throw error
  return { ...data, acumulado: 0, indice_valor_mensal: [] }
}

export async function updateIndice(id, fields) {
  const { data, error } = await supabase.from('indice').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteIndice(id) {
  const { error } = await supabase.from('indice').delete().eq('id', id)
  if (error) throw error
}

export async function fetchValoresMensais(indiceId) {
  const { data, error } = await supabase
    .from('indice_valor_mensal')
    .select('mes, percentual')
    .eq('indice_id', indiceId)
    .order('mes')
  if (error) throw error
  const porMes = new Map((data ?? []).map((v) => [v.mes, Number(v.percentual)]))
  return Array.from({ length: 12 }, (_, i) => porMes.get(i + 1) ?? 0)
}

export async function salvarValoresMensais(indiceId, valores) {
  const rows = valores.map((percentual, i) => ({ indice_id: indiceId, mes: i + 1, percentual }))
  const { error } = await supabase.from('indice_valor_mensal').upsert(rows, { onConflict: 'indice_id,mes' })
  if (error) throw error
}
