import { supabase } from './supabaseClient'

export async function fetchContas() {
  const { data, error } = await supabase.from('conta').select('*').order('codigo')
  if (error) throw error
  return data ?? []
}

export async function createConta({ codigo, nome, linha_pl, categoria }) {
  const { data, error } = await supabase
    .from('conta')
    .insert({ codigo, nome, linha_pl: linha_pl || null, categoria: categoria || null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateConta(id, fields) {
  const { data, error } = await supabase.from('conta').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteConta(id) {
  const { error } = await supabase.from('conta').delete().eq('id', id)
  if (error) throw error
}
