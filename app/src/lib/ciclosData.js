import { supabase } from './supabaseClient'

export async function fetchCiclos() {
  const { data, error } = await supabase
    .from('ciclo')
    .select('*, versao(id, nome, status)')
    .order('ano', { ascending: false })
  if (error) throw error
  return (data ?? []).map((c) => {
    const versoes = c.versao ?? []
    const ativa = versoes.find((v) => v.status === 'ativa')
    return { ...c, nVersoes: versoes.length, versaoAtivaNome: ativa?.nome ?? '—' }
  })
}

export async function createCiclo(ano) {
  const { data: ciclo, error } = await supabase.from('ciclo').insert({ ano, status: 'em_elaboracao' }).select().single()
  if (error) throw error
  const { error: versaoError } = await supabase
    .from('versao')
    .insert({ ciclo_id: ciclo.id, nome: 'Original', tipo: 'original', status: 'ativa' })
  if (versaoError) throw versaoError
  return ciclo
}

export async function updateCicloStatus(id, status) {
  const { error } = await supabase.from('ciclo').update({ status }).eq('id', id)
  if (error) throw error
}

export async function fetchVersoes(cicloId) {
  const { data, error } = await supabase
    .from('versao')
    .select('*, baseada_em:baseada_em_id(nome)')
    .eq('ciclo_id', cicloId)
    .order('criada_em', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchTodasVersoesPendentes() {
  const { data, error } = await supabase
    .from('versao')
    .select('*, ciclo:ciclo_id(ano)')
    .eq('status', 'rascunho')
    .order('criada_em', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function criarVersaoRevisao(cicloId, baseadaEmId, nome) {
  const { data, error } = await supabase
    .from('versao')
    .insert({ ciclo_id: cicloId, tipo: 'revisao', status: 'rascunho', baseada_em_id: baseadaEmId, nome })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function ativarVersao(id, cicloId) {
  const { error: e1 } = await supabase.from('versao').update({ status: 'encerrada' }).eq('ciclo_id', cicloId).eq('status', 'ativa')
  if (e1) throw e1
  const { error: e2 } = await supabase.from('versao').update({ status: 'ativa' }).eq('id', id)
  if (e2) throw e2
}

export async function encerrarVersao(id) {
  const { error } = await supabase.from('versao').update({ status: 'encerrada' }).eq('id', id)
  if (error) throw error
}

export async function reprovarVersao(id) {
  const { error } = await supabase.from('versao').update({ status: 'reprovada' }).eq('id', id)
  if (error) throw error
}

export async function duplicarVersao(versaoOrigem) {
  const novaVersao = await criarVersaoRevisao(versaoOrigem.ciclo_id, versaoOrigem.id, `Cópia de ${versaoOrigem.nome}`)

  const { data: lancamentos, error: errLanc } = await supabase
    .from('lancamento')
    .select('*, lancamento_valor_mensal(mes, valor)')
    .eq('versao_id', versaoOrigem.id)
  if (errLanc) throw errLanc

  for (const l of lancamentos ?? []) {
    const { id, criado_em, lancamento_valor_mensal, ...campos } = l
    const { data: novoLancamento, error: errNovo } = await supabase
      .from('lancamento')
      .insert({ ...campos, versao_id: novaVersao.id })
      .select()
      .single()
    if (errNovo) throw errNovo
    if (lancamento_valor_mensal?.length) {
      const valores = lancamento_valor_mensal.map((v) => ({ lancamento_id: novoLancamento.id, mes: v.mes, valor: v.valor }))
      const { error: errValores } = await supabase.from('lancamento_valor_mensal').insert(valores)
      if (errValores) throw errValores
    }
  }

  return novaVersao
}
