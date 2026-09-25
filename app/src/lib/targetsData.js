import { supabase } from './supabaseClient'

/**
 * Target por pacote: o teto que o dono do pacote — o "pacoteiro" — combinou
 * para o ano. O outro lado da conta, o bottom up, sai da soma dos
 * lançamentos; quem compara os dois é o quadro "Target × Bottom Up".
 *
 * Tabela da migração 2026-09-22. Enquanto ela não roda, a busca devolve null
 * e a tela explica o que falta, em vez de quebrar.
 */
export async function fetchTargetsPacote(ano) {
  if (!ano) return []
  const { data, error } = await supabase
    .from('target_pacote')
    .select('pacote, valor, responsavel, observacao')
    .eq('ano', ano)
  if (error) return null
  return (data ?? []).map((t) => ({ ...t, valor: Number(t.valor) }))
}

/** Quantos targets o ano já tem — o aviso de "vai sobrescrever" sai daqui. */
export async function contarTargetsPacote(ano) {
  const { count, error } = await supabase
    .from('target_pacote')
    .select('id', { count: 'exact', head: true })
    .eq('ano', ano)
  if (error) return null
  return count ?? 0
}

/**
 * Grava os targets lidos do Template Pacoteiros.
 *
 * `upsert` por (ano, pacote): reenviar o arquivo corrige o valor em vez de
 * duplicar o pacote. `substituir` apaga antes o que o ano tinha — é o que
 * resolve o caso em que o pacoteiro TIROU uma linha do arquivo: sem apagar, o
 * target velho ficaria para sempre.
 */
export async function gravarTargetsPacote(ano, linhas, { substituir = false } = {}) {
  if (!ano) throw new Error('Sem ano não dá para gravar o target: ele é por ano e pacote.')
  if (substituir) {
    const { error } = await supabase.from('target_pacote').delete().eq('ano', ano)
    if (error) throw new Error(error.message)
  }
  const registros = linhas.map((l) => ({
    ano,
    pacote: l.pacote,
    valor: l.valor,
    responsavel: l.responsavel || null,
    observacao: l.observacao || null,
  }))
  if (!registros.length) return 0
  const { error } = await supabase.from('target_pacote').upsert(registros, { onConflict: 'ano,pacote' })
  if (error) throw new Error(error.message)
  return registros.length
}

/**
 * Os pacotes do cadastro, para dizer quais nomes do arquivo não existem na
 * lista oficial. Devolve null quando a tabela ainda não existe — aí a tela
 * simplesmente não cobra.
 */
export async function pacotesCadastrados() {
  const { data, error } = await supabase.from('pacote').select('nome')
  if (error) return null
  return (data ?? []).map((p) => p.nome)
}
