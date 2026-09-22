import { supabase } from './supabaseClient'
import { classificar } from './demonstrativo'

/**
 * Histórico de importação: um registro por Template Budget importado, com
 * quem subiu e os números do arquivo por empresa. Tabela da migração
 * 2026-09-22-historico-de-importacao.sql.
 *
 * Os números são a fotografia do momento: o registro diz o que o arquivo
 * trazia, não o que está gravado hoje.
 */

/**
 * Se a tabela existe. Enquanto a migração não for rodada a importação segue
 * normal — só não registra, e a lista mostra o aviso.
 */
let existe = null
export async function historicoDisponivel() {
  if (existe) return true
  const { error } = await supabase.from('importacao').select('id').limit(1)
  existe = !error
  return existe
}

const zero = () => ({ linhas: 0, gr: 0, nr: 0, despesa: 0, capex: 0 })
const soma = (v) => (v ?? []).reduce((a, x) => a + Number(x.valor ?? x ?? 0), 0)

/**
 * Os números de um tipo, por empresa, a partir das linhas conferidas.
 * Receita abre em Gross Revenue e Net Revenue pela linha do P&L da conta
 * (a dedução é linha própria, gravada negativa); Despesa e Capex somam o
 * valor do ano, com o sinal da importação (gasto positivo).
 */
export function resumirLinhas(linhas, tipo) {
  const porEmpresa = new Map()
  for (const p of linhas) {
    const emp = typeof p.empresa === 'object' ? p.empresa : null
    const id = emp?.id ?? null
    const nome = emp?.nome ?? String(p.empresa ?? '(sem empresa)')
    const chave = id ?? nome
    if (!porEmpresa.has(chave)) porEmpresa.set(chave, { id, nome, ...zero() })
    const e = porEmpresa.get(chave)
    const total = p.total ?? soma(p.valores)
    e.linhas += 1
    if (tipo === 'receita') {
      const k = classificar({ tipo, conta: p.conta, area: p.area, area_ajustada: p.area_ajustada })
      if (k === 'gr') e.gr += total
      if (k === 'gr' || k === 'ded') e.nr += total
    } else if (tipo === 'despesa') {
      e.despesa += total
    } else if (tipo === 'capex') {
      e.capex += total
    }
  }
  return [...porEmpresa.values()]
}

/** Junta a lista de empresas já registrada com a de um tipo novo. */
function juntarEmpresas(atuais, novas) {
  const mapa = new Map((atuais ?? []).map((e) => [e.id ?? e.nome, { ...zero(), ...e }]))
  for (const n of novas) {
    const k = n.id ?? n.nome
    const e = mapa.get(k) ?? { id: n.id, nome: n.nome, ...zero() }
    for (const c of ['linhas', 'gr', 'nr', 'despesa', 'capex']) e[c] += n[c]
    mapa.set(k, e)
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

function totalizar(empresas) {
  const t = zero()
  for (const e of empresas) for (const c of Object.keys(t)) t[c] += e[c] ?? 0
  return t
}

/**
 * Registra um tipo importado. Sem `id`, cria o registro do arquivo; com `id`,
 * acrescenta o tipo ao registro que já existe — Receita, Despesa e Capex do
 * mesmo upload viram uma linha só na lista. Devolve o id, ou null quando a
 * tabela ainda não existe. Falha aqui nunca derruba a importação: quem chama
 * trata o erro como aviso.
 */
export async function registrarImportacao({ id, arquivo, tamanho, origem, ano, ciclo, versao, tipo, linhas, apagados, usuarioEmail }) {
  if (!(await historicoDisponivel())) return null
  const empresasTipo = resumirLinhas(linhas, tipo)
  const infoTipo = {
    linhas: linhas.length,
    total: linhas.reduce((a, p) => a + (p.total ?? soma(p.valores)), 0),
    apagados: apagados ?? 0,
    desfeito: false,
  }

  if (id) {
    const { data: atual, error } = await supabase.from('importacao').select('tipos, empresas').eq('id', id).single()
    if (error) throw error
    const empresas = juntarEmpresas(atual.empresas, empresasTipo)
    const { error: e2 } = await supabase
      .from('importacao')
      .update({
        tipos: { ...atual.tipos, [tipo]: infoTipo },
        empresas,
        totais: totalizar(empresas),
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id)
    if (e2) throw e2
    return id
  }

  const empresas = juntarEmpresas([], empresasTipo)
  const { data, error } = await supabase
    .from('importacao')
    .insert({
      usuario_email: usuarioEmail ?? null,
      arquivo,
      tamanho_bytes: tamanho ?? null,
      origem,
      ano: ano ?? null,
      ciclo_id: ciclo?.id ?? null,
      versao_id: versao?.id ?? null,
      versao_nome: versao?.nome ?? null,
      tipos: { [tipo]: infoTipo },
      empresas,
      totais: totalizar(empresas),
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

/** Marca um tipo como desfeito — o registro fica, para o histórico. */
export async function marcarDesfeito(id, tipo) {
  if (!id) return
  const { data: atual, error } = await supabase.from('importacao').select('tipos').eq('id', id).single()
  if (error) throw error
  const tipos = { ...atual.tipos, [tipo]: { ...atual.tipos?.[tipo], desfeito: true } }
  const { error: e2 } = await supabase
    .from('importacao')
    .update({ tipos, atualizado_em: new Date().toISOString() })
    .eq('id', id)
  if (e2) throw e2
}

/**
 * As importações, da mais nova para a mais antiga, com o nome de quem subiu
 * quando o e-mail está no cadastro de usuários.
 */
export async function listarImportacoes(limite = 200) {
  const [imp, usu] = await Promise.all([
    supabase.from('importacao').select('*').order('criado_em', { ascending: false }).limit(limite),
    supabase.from('usuario').select('nome, email'),
  ])
  if (imp.error) throw imp.error
  const nomes = new Map((usu.data ?? []).map((u) => [u.email.toLowerCase(), u.nome]))
  return imp.data.map((r) => ({ ...r, usuario_nome: r.usuario_email ? nomes.get(r.usuario_email.toLowerCase()) ?? null : null }))
}
