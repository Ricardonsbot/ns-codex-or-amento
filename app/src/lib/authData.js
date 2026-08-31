import { supabase } from './supabaseClient'

export async function entrar(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) throw error
  return data.session
}

export async function sair() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function obterSessaoAtual() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export function aoMudarAutenticacao(callback) {
  const { data } = supabase.auth.onAuthStateChange((_evento, session) => callback(session))
  return () => data.subscription.unsubscribe()
}
