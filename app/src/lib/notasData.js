import { supabase } from './supabaseClient'

/**
 * O bloco de notas do time — tabela da migração 2026-09-30. Compartilhado:
 * o que alguém anota aqui, todo mundo vê, porque é o mesmo Supabase de tudo
 * o resto. Devolve `null` quando a tabela ainda não existe, para a tela
 * mostrar o aviso em vez de quebrar.
 */
export async function fetchNotas(secao) {
  const { data, error } = await supabase
    .from('nota')
    .select('id, texto, feita, criado_em, criado_por, concluido_em, concluido_por')
    .eq('secao', secao)
    .order('feita', { ascending: true })
    .order('criado_em', { ascending: true })
  if (error) return null
  return data ?? []
}

export async function criarNota(secao, texto, email) {
  const { data, error } = await supabase
    .from('nota')
    .insert({ secao, texto: texto.trim(), criado_por: email ?? null })
    .select('id, texto, feita, criado_em, criado_por, concluido_em, concluido_por')
    .single()
  if (error) throw new Error(error.message)
  return data
}

/** Marca feita/pendente de novo — quem desmarcar não perde o texto. */
export async function marcarNota(id, feita, email) {
  const { error } = await supabase
    .from('nota')
    .update({
      feita,
      concluido_em: feita ? new Date().toISOString() : null,
      concluido_por: feita ? email ?? null : null,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function editarNota(id, texto) {
  const { error } = await supabase.from('nota').update({ texto: texto.trim() }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function removerNota(id) {
  const { error } = await supabase.from('nota').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
