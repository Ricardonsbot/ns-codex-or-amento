import { supabase } from './supabaseClient'

export async function fetchAll(tabela, ordenarPor = 'nome') {
  const { data, error } = await supabase.from(tabela).select('*').order(ordenarPor, { nullsFirst: false })
  if (error) throw error
  return data ?? []
}

export async function criar(tabela, valores) {
  const { data, error } = await supabase.from(tabela).insert(valores).select().single()
  if (error) throw error
  return data
}

export async function atualizar(tabela, id, valores) {
  const { data, error } = await supabase.from(tabela).update(valores).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function remover(tabela, id) {
  const { error } = await supabase.from(tabela).delete().eq('id', id)
  if (error) throw error
}
