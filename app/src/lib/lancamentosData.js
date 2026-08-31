import { supabase } from './supabaseClient'

export async function fetchVersaoAtual() {
  const { data: ciclos, error } = await supabase
    .from('ciclo')
    .select('*')
    .neq('status', 'encerrado')
    .order('ano', { ascending: false })
  if (error) throw error
  if (!ciclos?.length) return null
  const ciclo = ciclos[0]
  const { data: versoes, error: errV } = await supabase
    .from('versao')
    .select('*')
    .eq('ciclo_id', ciclo.id)
    .eq('status', 'ativa')
    .limit(1)
  if (errV) throw errV
  return { ciclo, versao: versoes?.[0] ?? null }
}

const SELECT_LANCAMENTO = '*, conta:conta_id(id, codigo, nome, linha_pl, categoria), lancamento_valor_mensal(mes, valor)'

export async function fetchLancamentos({ tipo, versaoId, buId, torreId, empresaId }) {
  let query = supabase.from('lancamento').select(SELECT_LANCAMENTO).eq('tipo', tipo).eq('versao_id', versaoId)
  if (buId) query = query.eq('bu_id', buId)
  if (torreId) query = query.eq('torre_id', torreId)
  if (empresaId) query = query.eq('empresa_id', empresaId)
  const { data, error } = await query.order('criado_em')
  if (error) throw error
  return data ?? []
}

export async function createLancamento(fields) {
  const { data, error } = await supabase.from('lancamento').insert(fields).select(SELECT_LANCAMENTO).single()
  if (error) throw error
  return data
}

export async function updateLancamento(id, campos) {
  const { data, error } = await supabase.from('lancamento').update(campos).eq('id', id).select(SELECT_LANCAMENTO).single()
  if (error) throw error
  return data
}

export async function deleteLancamento(id) {
  const { error } = await supabase.from('lancamento').delete().eq('id', id)
  if (error) throw error
}

export async function salvarValoresMensais(lancamentoId, valores) {
  const rows = valores.map((valor, i) => ({ lancamento_id: lancamentoId, mes: i + 1, valor: valor || 0 }))
  const { error } = await supabase.from('lancamento_valor_mensal').upsert(rows, { onConflict: 'lancamento_id,mes' })
  if (error) throw error
}

export async function duplicarLancamento(lancamento) {
  const { id, criado_em, conta, lancamento_valor_mensal, valores, ...fields } = lancamento
  const novo = await createLancamento(fields)
  if (lancamento_valor_mensal?.length) {
    const valores = Array.from({ length: 12 }, (_, i) => lancamento_valor_mensal.find((v) => v.mes === i + 1)?.valor ?? 0)
    await salvarValoresMensais(novo.id, valores)
    novo.lancamento_valor_mensal = lancamento_valor_mensal
  }
  return novo
}
