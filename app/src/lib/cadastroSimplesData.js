import { supabase } from './supabaseClient'

// O PostgREST corta a resposta em 1000 linhas por padrão, e sem erro: a tela
// simplesmente mostrava parte do cadastro achando que era o total. Nenhum
// cadastro passava disso até `cliente` chegar a 3.361 vindo da base de PDD.
const PAGINA = 1000

export async function fetchAll(tabela, ordenarPor = 'nome') {
  const linhas = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from(tabela)
      .select('*')
      .order(ordenarPor, { nullsFirst: false })
      .range(de, de + PAGINA - 1)
    if (error) throw error
    linhas.push(...(data ?? []))
    if (!data || data.length < PAGINA) return linhas
  }
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
