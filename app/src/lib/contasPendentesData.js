import { supabase } from './supabaseClient'
import { PREFIXO_PL } from './linhasPl'

/**
 * Pendência de Cadastros: as contas que a importação achou na planilha e que
 * não existem no plano.
 *
 * O caminho é: a importação envia o pedido → alguém aprova ou reprova na tela
 * de Pendência de Cadastros → aprovar cria a conta, guardando a data e o
 * motivo. Antes disso, a linha entrava no orçamento apenas marcada, e a marca
 * ficava lá para sempre porque não havia onde resolvê-la.
 */

/**
 * Se a tabela existe. Enquanto a migração 2026-09-09 não for rodada, a tela de
 * importação não oferece o envio — em vez de quebrar ao clicar.
 */
let existe = null
export async function tabelaDisponivel() {
  if (existe !== null) return existe
  const { error } = await supabase.from('conta_pendente').select('id').limit(1)
  existe = !error
  return existe
}

/**
 * Junta as linhas que a importação não resolveu num pedido por RÓTULO, não por
 * linha: 81 linhas de "CS dedicado" são um cadastro só, não 81 pedidos.
 */
export function agruparParaCadastro(marcadas, tipo, origem) {
  const porRotulo = new Map()
  for (const m of marcadas) {
    const rotulo = (m.contaCodigo || m.contaRotulo || '').trim()
    const chave = rotulo || '(sem conta na planilha)'
    if (!porRotulo.has(chave)) {
      porRotulo.set(chave, { rotulo: chave, tipo, origem, linhas: 0, valor: 0, empresas: new Set(), motivos: new Set() })
    }
    const p = porRotulo.get(chave)
    p.linhas += 1
    p.valor += m.total
    p.empresas.add(m.empresa?.nome ?? '—')
    for (const f of m.falhas ?? []) p.motivos.add(f)
  }

  return [...porRotulo.values()].map((p) => ({
    rotulo: p.rotulo,
    tipo: p.tipo,
    origem: p.origem,
    linhas: p.linhas,
    valor: Math.round(p.valor * 100) / 100,
    descricao: `${p.linhas} linha(s) em ${[...p.empresas].slice(0, 4).join(', ')}${p.empresas.size > 4 ? ` e mais ${p.empresas.size - 4}` : ''}`,
    motivo: [...p.motivos].join(' · '),
  }))
}

export async function fetchPendentes() {
  const { data, error } = await supabase
    .from('conta_pendente')
    .select('*, conta:conta_id(codigo, nome)')
    .order('solicitado_em', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Envia os pedidos. Rótulo que já está em aberto é ignorado, não duplicado. */
export async function solicitar(pedidos, quem) {
  if (!pedidos.length) return 0
  const { data: abertos } = await supabase
    .from('conta_pendente')
    .select('rotulo, tipo')
    .eq('status', 'pendente')
  const jaAberto = new Set((abertos ?? []).map((p) => `${p.rotulo.toLowerCase()}|${p.tipo}`))
  const novos = pedidos.filter((p) => !jaAberto.has(`${p.rotulo.toLowerCase()}|${p.tipo}`))
  if (!novos.length) return 0

  const { data, error } = await supabase
    .from('conta_pendente')
    .insert(novos.map((p) => ({ ...p, solicitado_por: quem ?? null })))
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

/**
 * Aprova: cria a conta no plano e liga o pedido a ela.
 *
 * O código vem de quem aprova — o plano da NSTECH é hierárquico e adivinhar
 * onde a conta entra é decisão de contabilidade, não do software.
 */
export async function aprovar(pendencia, { codigo, nome, linhaPl, categoria, observacao, quem }) {
  const { data: conta, error } = await supabase
    .from('conta')
    .insert({
      codigo: codigo.trim(),
      nome: (nome || pendencia.rotulo).trim(),
      linha_pl: linhaPl || `${PREFIXO_PL[pendencia.tipo]} > Gross Revenue`,
      categoria: categoria || null,
      criada_em: new Date().toISOString(),
      motivo: observacao || `Cadastrada pela Pendência de Cadastros, a partir de "${pendencia.rotulo}" do template ${pendencia.origem ?? ''}`.trim(),
    })
    .select('id, codigo, nome')
    .single()
  if (error) throw error

  const { error: erroP } = await supabase
    .from('conta_pendente')
    .update({
      status: 'aprovada',
      decidido_em: new Date().toISOString(),
      decidido_por: quem ?? null,
      observacao_decisao: observacao || null,
      conta_id: conta.id,
    })
    .eq('id', pendencia.id)
  if (erroP) throw erroP
  return conta
}

export async function reprovar(pendencia, { observacao, quem }) {
  const { error } = await supabase
    .from('conta_pendente')
    .update({
      status: 'reprovada',
      decidido_em: new Date().toISOString(),
      decidido_por: quem ?? null,
      observacao_decisao: observacao || null,
    })
    .eq('id', pendencia.id)
  if (error) throw error
}

/**
 * Pendência de Centro de Custo: mesmo mecanismo da conta acima — a
 * importação envia o pedido, alguém aprova ou reprova em /pendencia-
 * -cadastros, aprovar cria o centro de custo. Migração
 * 2026-10-01-pendencia-de-centro-de-custo.sql.
 */
let existeCC = null
export async function centroCustoPendenteDisponivel() {
  if (existeCC !== null) return existeCC
  const { error } = await supabase.from('centro_custo_pendente').select('id').limit(1)
  existeCC = !error
  return existeCC
}

/** Igual a `agruparParaCadastro`, mas pelo centro de custo da linha. */
export function agruparParaCadastroCentroCusto(linhas, tipo, origem) {
  const porRotulo = new Map()
  for (const l of linhas) {
    const rotulo = (l.centro_custo_nome || l.centroCusto || '').trim()
    if (!rotulo) continue
    if (!porRotulo.has(rotulo)) {
      porRotulo.set(rotulo, { rotulo, tipo, origem, linhas: 0, valor: 0, empresas: new Set() })
    }
    const p = porRotulo.get(rotulo)
    p.linhas += 1
    p.valor += Number(l.total ?? 0)
    p.empresas.add((typeof l.empresa === 'object' ? l.empresa?.nome : l.empresa) ?? '—')
  }

  return [...porRotulo.values()].map((p) => ({
    rotulo: p.rotulo,
    tipo: p.tipo,
    origem: p.origem,
    linhas: p.linhas,
    valor: Math.round(p.valor * 100) / 100,
    descricao: `${p.linhas} linha(s) em ${[...p.empresas].slice(0, 4).join(', ')}${p.empresas.size > 4 ? ` e mais ${p.empresas.size - 4}` : ''}`,
    motivo: 'Centro de custo não encontrado no cadastro',
  }))
}

export async function fetchPendentesCentroCusto() {
  const { data, error } = await supabase
    .from('centro_custo_pendente')
    .select('*, centro_custo:centro_custo_id(codigo, nome)')
    .order('solicitado_em', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function solicitarCentroCusto(pedidos, quem) {
  if (!pedidos.length) return 0
  const { data: abertos } = await supabase
    .from('centro_custo_pendente')
    .select('rotulo, tipo')
    .eq('status', 'pendente')
  const jaAberto = new Set((abertos ?? []).map((p) => `${p.rotulo.toLowerCase()}|${p.tipo}`))
  const novos = pedidos.filter((p) => !jaAberto.has(`${p.rotulo.toLowerCase()}|${p.tipo}`))
  if (!novos.length) return 0

  const { data, error } = await supabase
    .from('centro_custo_pendente')
    .insert(novos.map((p) => ({ ...p, solicitado_por: quem ?? null })))
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

/** Aprova: cria o centro de custo e liga o pedido a ele. */
export async function aprovarCentroCusto(pendencia, { codigo, nome, observacao, quem }) {
  const { data: cc, error } = await supabase
    .from('centro_de_custo')
    .insert({ codigo: codigo.trim(), nome: (nome || pendencia.rotulo).trim() })
    .select('id, codigo, nome')
    .single()
  if (error) throw error

  const { error: erroP } = await supabase
    .from('centro_custo_pendente')
    .update({
      status: 'aprovada',
      decidido_em: new Date().toISOString(),
      decidido_por: quem ?? null,
      observacao_decisao: observacao || null,
      centro_custo_id: cc.id,
    })
    .eq('id', pendencia.id)
  if (erroP) throw erroP
  return cc
}

export async function reprovarCentroCusto(pendencia, { observacao, quem }) {
  const { error } = await supabase
    .from('centro_custo_pendente')
    .update({
      status: 'reprovada',
      decidido_em: new Date().toISOString(),
      decidido_por: quem ?? null,
      observacao_decisao: observacao || null,
    })
    .eq('id', pendencia.id)
  if (error) throw error
}
