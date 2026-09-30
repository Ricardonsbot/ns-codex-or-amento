import { supabase } from './supabaseClient'

/**
 * O histórico de erros: toda vez que um toast de erro aparece na tela, o
 * texto inteiro fica gravado aqui também — é o que o ícone de log (canto da
 * barra lateral) lista, pra copiar e colar numa IA sem precisar reproduzir
 * o problema de novo.
 */

let existe = null
async function disponivel() {
  if (existe !== null) return existe
  const { error } = await supabase.from('log_erro').select('id').limit(1)
  existe = !error
  return existe
}

/**
 * Registra um erro. Nunca lança: chamado de dentro do próprio mecanismo de
 * toast, uma falha aqui não pode virar um segundo erro em cima do primeiro.
 */
export async function registrarErro({ mensagem, contexto }) {
  try {
    if (!(await disponivel())) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    await supabase.from('log_erro').insert({
      mensagem,
      contexto: contexto ?? null,
      usuario_email: user?.email ?? null,
    })
  } catch {
    // Registrar o erro é acessório: o toast já avisou quem está na tela.
  }
}

export async function listarErros(limite = 200) {
  const { data, error } = await supabase
    .from('log_erro')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(limite)
  if (error) throw error
  return data ?? []
}
