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

/**
 * As medições que o checklist usa e que só existem no momento da importação:
 * depois de gravado, ninguém consegue reconstruir "o que a planilha trazia".
 *
 *   semArea       linhas de gasto operacional sem área de alocação — sem ela
 *                 o valor não vira CoGS, G&A, S&M nem R&D
 *   mesesVazios   empresas com algum mês sem valor nenhum: budget com buraco
 *   sinaisTrocados linhas de gasto com total negativo (ou receita negativa)
 */
const norm = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()

/** O valor que cada dimensão tem na linha, por tipo de template. */
const DIMENSOES = {
  centroCusto: (p) => p.centro_custo_nome || p.centroCusto,
  pacote: (p) => p.pacote,
  subpacote: (p) => p.subpacote,
  fornecedor: (p) => p.fornecedor,
  produto: (p) => p.produto_analitico || p.produto_sintetico,
  cliente: (p) => p.cliente,
  diretoria: (p) => p.diretoria,
}

/**
 * Quantas linhas trazem um valor que não está no cadastro, por dimensão.
 * Casa por código ou por nome, ignorando acento e caixa; o template junta os
 * dois no mesmo campo ("1234 · CSC - FP&A"), então basta um deles aparecer.
 */
function conferirCadastros(linhas, cadastros) {
  const saida = {}
  for (const [chave, ler] of Object.entries(DIMENSOES)) {
    const registrados = cadastros?.[chave]
    if (!registrados) continue // tabela ausente: sem item no checklist
    const conhecidos = registrados.map(norm).filter(Boolean)
    const usados = new Map() // valor -> quantas linhas
    for (const p of linhas) {
      const v = ler(p)
      if (!v) continue
      usados.set(v, (usados.get(v) ?? 0) + 1)
    }
    if (!usados.size) continue // a dimensão não vem neste template
    let linhasFora = 0
    const exemplos = []
    for (const [valor, quantas] of usados) {
      const n = norm(valor)
      const achou = conhecidos.some((c) => n === c || n.includes(c))
      if (achou) continue
      linhasFora += quantas
      if (exemplos.length < 3) exemplos.push(valor)
    }
    saida[chave] = { linhas: linhasFora, valores: usados.size, exemplos }
  }
  return saida
}

/**
 * Campos que o status "Essencial" e o "Ideal" olham, por preenchimento.
 * Churn não existe como coluna do template; fica registrado como ausente, e
 * o item some do quadro em vez de acusar falso negativo.
 */
const PREENCHIMENTO = {
  valor: (p) => (p.total ?? 0) !== 0,
  centroCusto: (p) => Boolean(p.centro_custo_nome || p.centroCusto),
  pacote: (p) => Boolean(p.pacote),
  contaContabil: (p) => Boolean(p.conta),
  empresa: (p) => Boolean(typeof p.empresa === 'object' ? p.empresa?.id : p.empresa),
  mrr: (p) => Boolean(p.mrr),
  cliente: (p) => Boolean(p.cliente),
  churn: (p) => Boolean(p.churn),
  subpacote: (p) => Boolean(p.subpacote),
}

export function medirLinhas(linhas, tipo, cadastros) {
  let semArea = 0
  let sinaisTrocados = 0
  let caixa = 0
  const vazios = Object.fromEntries(Object.keys(PREENCHIMENTO).map((k) => [k, 0]))
  // Linha do P&L: a da conta no plano é a que manda. Duas coisas podem dar
  // errado — a conta cair numa linha que a Master não conhece (o valor some
  // do P&L) e a coluna "Linha P&L" do template discordar do plano.
  let plDesconhecida = 0
  let plDivergente = 0
  const plExemplos = []
  const meses = new Map() // empresa -> 12 bandeiras de "tem valor"

  for (const p of linhas) {
    const total = p.total ?? soma(p.valores)
    for (const [chave, tem] of Object.entries(PREENCHIMENTO)) if (!tem({ ...p, total })) vazios[chave] += 1
    for (const v of p.valores ?? []) caixa += Number(v?.valor_caixa ?? 0)
    if (tipo !== 'receita' && total < 0) sinaisTrocados += 1
    if (tipo === 'receita' && total < 0) sinaisTrocados += 1
    const chave = classificar({ tipo, conta: p.conta, area: p.area, area_ajustada: p.area_ajustada })
    if (tipo !== 'capex' && chave === 'semArea') semArea += 1
    if (p.conta && (!chave || String(chave).startsWith('fora:'))) {
      plDesconhecida += 1
      if (plExemplos.length < 3) plExemplos.push(p.conta.linha_pl || '(conta sem linha do P&L)')
    }
    const doTemplate = p.linha_pl_ajustada || p.linha_pl_template
    if (p.conta?.linha_pl && doTemplate && norm(doTemplate) !== norm(p.conta.linha_pl)) plDivergente += 1
    const nome = (typeof p.empresa === 'object' ? p.empresa?.nome : p.empresa) ?? '(sem empresa)'
    if (!meses.has(nome)) meses.set(nome, Array(12).fill(false))
    const bandeiras = meses.get(nome)
    ;(p.valores ?? []).forEach((v, i) => {
      if (Number(v?.valor ?? v ?? 0)) bandeiras[i] = true
    })
  }

  const mesesVazios = [...meses.values()].filter((b) => b.some((x) => !x)).length
  return {
    semArea,
    sinaisTrocados,
    mesesVazios,
    plDesconhecida,
    plDivergente,
    plExemplos,
    vazios,
    caixa,
    empresas: meses.size,
    cadastros: conferirCadastros(linhas, cadastros),
  }
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
export async function registrarImportacao({
  id,
  arquivo,
  tamanho,
  origem,
  ano,
  ciclo,
  versao,
  tipo,
  linhas,
  apagados,
  fora,
  marcadas,
  somouEmCima,
  cadastros,
  usuarioEmail,
  formato,
}) {
  if (!(await historicoDisponivel())) return null
  const empresasTipo = resumirLinhas(linhas, tipo)
  const infoTipo = {
    linhas: linhas.length,
    total: linhas.reduce((a, p) => a + (p.total ?? soma(p.valores)), 0),
    apagados: apagados ?? 0,
    // O que a conferência apontou, para o checklist da flag: linhas que não
    // entraram por falta de empresa cadastrada e linhas que entraram sem conta.
    fora: fora ?? 0,
    marcadas: marcadas ?? 0,
    somouEmCima: Boolean(somouEmCima),
    ...medirLinhas(linhas, tipo, cadastros),
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
      formato: formato ?? null,
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
 * A liberação do template: o checklist diz se o arquivo está tecnicamente
 * apto; isto é a decisão de quem responde pelo número.
 *
 *   aguardando  entrou e ninguém olhou ainda
 *   liberado    o FP&A da BU (ou o Corporate) aceitou — pode consolidar
 *   devolvido   volta para quem enviou, com motivo
 *
 * Devolver exige motivo: "devolvido" sem explicação vira ping-pong.
 */
export const LIBERACOES = {
  aguardando: { rotulo: 'Aguardando', cor: 'cinza' },
  liberado: { rotulo: 'Liberado', cor: 'verde' },
  devolvido: { rotulo: 'Devolvido', cor: 'vermelho' },
}

export async function definirLiberacao(id, { status, quem, observacao }) {
  if (!LIBERACOES[status]) throw new Error(`Liberação "${status}" não existe.`)
  if (status === 'devolvido' && !observacao?.trim()) throw new Error('Diga o motivo da devolução.')
  const { error } = await supabase
    .from('importacao')
    .update({
      liberacao: status,
      liberado_por: status === 'aguardando' ? null : quem ?? null,
      liberado_em: status === 'aguardando' ? null : new Date().toISOString(),
      liberacao_obs: observacao?.trim() || null,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
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

/**
 * O registro de uma importação recém-feita, no mesmo formato do que vai para
 * o banco. Serve ao checklist que aparece na tela logo depois de gravar —
 * assim ele funciona mesmo antes de a migração do histórico ter rodado.
 */
export function resumoDaImportacao({ ano, versao, tipo, linhas, fora, marcadas, apagados, somouEmCima, cadastros }) {
  const empresas = resumirLinhas(linhas, tipo)
  return {
    ano: ano ?? null,
    versao_nome: versao?.nome ?? null,
    tipos: {
      [tipo]: {
        linhas: linhas.length,
        apagados: apagados ?? 0,
        fora: fora ?? 0,
        marcadas: marcadas ?? 0,
        somouEmCima: Boolean(somouEmCima),
        ...medirLinhas(linhas, tipo, cadastros),
        desfeito: false,
      },
    },
    empresas,
    totais: empresas.reduce(
      (t, e) => ({
        linhas: t.linhas + e.linhas,
        gr: t.gr + e.gr,
        nr: t.nr + e.nr,
        despesa: t.despesa + e.despesa,
        capex: t.capex + e.capex,
      }),
      zero()
    ),
  }
}

/**
 * O quadro de status do template, em três níveis:
 *
 *   Essencial     o que o consolidado precisa para fechar. Falhou, o template
 *                 fica "Não liberado" e vira impedimento.
 *   Ideal         o que enriquece a análise (MRR, cliente, churn, subpacote).
 *                 Falhou, é pendência: consolida do mesmo jeito.
 *   Medidas       Net Revenue, Gasto, Capex e Fluxo de Caixa, com o sinal de
 *                 que o arquivo trouxe cada um.
 *
 * `ok` de cada item é "todas as linhas têm"; `faltam` diz em quantas não tem.
 */
export function avaliar(registro, escopo = 'arquivo') {
  const tipos = registro?.tipos ?? {}
  const t = registro?.totais ?? {}
  const usados = ['receita', 'despesa', 'capex'].filter((x) => tipos[x])
  const linhas = usados.reduce((a, x) => a + (tipos[x]?.linhas ?? 0), 0)
  const vazio = (campo) => usados.reduce((a, x) => a + (tipos[x]?.vazios?.[campo] ?? 0), 0)
  const temCampo = (campo) => usados.some((x) => tipos[x]?.vazios?.[campo] !== undefined)
  const somar = (campo) => usados.reduce((a, x) => a + (tipos[x]?.[campo] ?? 0), 0)

  const item = (chave, rotulo, faltam, detalhe) => ({
    chave,
    rotulo,
    faltam,
    ok: faltam === 0,
    detalhe: detalhe ?? (faltam ? `${faltam} de ${linhas} linha(s) sem` : 'todas as linhas têm'),
  })

  // Essenciais. Empresa e conta olham também o cadastro: campo preenchido com
  // nome que não existe no cadastro não serve para consolidar.
  const foraEmpresa = somar('fora')
  const semConta = somar('marcadas')
  const foraDoCadastro = (dim) => usados.reduce((a, x) => a + (tipos[x]?.cadastros?.[dim]?.linhas ?? 0), 0)
  const ccFora = foraDoCadastro('centroCusto')
  const pacoteFora = foraDoCadastro('pacote')
  const subFora = foraDoCadastro('subpacote')
  const essenciais = [
    item('valor', 'Valor', vazio('valor')),
    item(
      'centroCusto',
      'Centro de custo',
      vazio('centroCusto') + ccFora,
      vazio('centroCusto') + ccFora
        ? `${vazio('centroCusto')} sem preencher · ${ccFora} fora do cadastro`
        : 'preenchido e cadastrado'
    ),
    item(
      'pacote',
      'Pacote',
      vazio('pacote') + pacoteFora,
      vazio('pacote') + pacoteFora
        ? `${vazio('pacote')} sem preencher · ${pacoteFora} fora do cadastro de Pacotes`
        : 'preenchido e cadastrado'
    ),
    item(
      'contaContabil',
      'Conta contábil',
      semConta,
      semConta ? `${semConta} linha(s) sem conta no plano` : 'todas no plano de contas'
    ),
    item(
      'empresa',
      'Empresa',
      foraEmpresa,
      foraEmpresa ? `${foraEmpresa} linha(s) com empresa fora do cadastro` : 'todas cadastradas'
    ),
  ]

  const ideais = [
    ['mrr', 'MRR'],
    ['cliente', 'Cliente'],
    ['churn', 'Churn'],
    ['subpacote', 'Subpacote'],
  ]
    .filter(([campo]) => temCampo(campo) && vazio(campo) < linhas) // campo que o template não traz não vira item
    .map(([campo, rotulo]) =>
      campo === 'subpacote'
        ? item(
            campo,
            rotulo,
            vazio(campo) + subFora,
            vazio(campo) + subFora
              ? `${vazio(campo)} sem preencher · ${subFora} fora do cadastro de Subpacotes`
              : 'preenchido e cadastrado'
          )
        : item(campo, rotulo, vazio(campo))
    )

  const impedimentos = essenciais.filter((i) => !i.ok)
  const pendencias = ideais.filter((i) => !i.ok)
  const liberado = impedimentos.length === 0

  const medidas = [
    { chave: 'nr', rotulo: 'Net Revenue', valor: t.nr ?? 0 },
    { chave: 'despesa', rotulo: 'Gasto', valor: t.despesa ?? 0 },
    { chave: 'capex', rotulo: 'Capex', valor: t.capex ?? 0 },
    { chave: 'caixa', rotulo: 'Fluxo de Caixa', valor: somar('caixa') },
  ].map((m) => ({ ...m, cor: m.valor ? 'verde' : 'amarelo' }))

  return {
    escopo,
    essenciais,
    ideais,
    impedimentos,
    pendencias,
    medidas,
    liberado,
    apto: liberado,
    // O que aparece na coluna Motivo da lista.
    motivo: !liberado ? 'Não liberado' : pendencias.length ? 'Pendência' : 'Liberado',
    corEssencial: liberado ? 'verde' : 'vermelho',
    corIdeal: pendencias.length ? 'amarelo' : 'verde',
  }
}

/**
 * Dois registros de exemplo, para a tela poder ser vista antes de a migração
 * rodar. Não vêm do banco, só aparecem quando a tabela ainda não existe e são
 * marcados como exemplo na tela — nunca se misturam com dado real.
 */
export function exemploDeHistorico() {
  const empresa = (nome, linhas, gr, despesa, capex) => ({ nome, linhas, gr, nr: gr * 0.94, despesa, capex })
  const somaEmpresas = (lista) => ({
    linhas: lista.reduce((a, e) => a + e.linhas, 0),
    gr: lista.reduce((a, e) => a + e.gr, 0),
    nr: lista.reduce((a, e) => a + e.nr, 0),
    despesa: lista.reduce((a, e) => a + e.despesa, 0),
    capex: lista.reduce((a, e) => a + e.capex, 0),
  })
  const info = (linhas, { fora = 0, marcadas = 0, vazios = {}, caixa = 0 } = {}) => ({
    linhas,
    total: 0,
    apagados: 0,
    fora,
    marcadas,
    somouEmCima: false,
    desfeito: false,
    caixa,
    vazios: { valor: 0, centroCusto: 0, contaContabil: 0, empresa: 0, mrr: 0, cliente: 0, churn: linhas, subpacote: 0, ...vazios },
    cadastros: {},
  })

  const logrisk = [empresa('LogRisk', 410, 70_500_000, 46_500_000, 3_200_000)]
  const brk = [empresa('BRK', 980, 184_400_000, 95_500_000, 6_100_000)]
  const buonny = [empresa('Buonny', 260, 21_300_000, 14_800_000, 900_000)]

  const linha = (id, arquivo, empresas, tipos, horas, liberacao = {}) => ({
    id,
    criado_em: new Date(Date.now() - horas * 36e5).toISOString(),
    usuario_email: 'emerson.nakamura@nstech.com.br',
    usuario_nome: 'Emerson Tadashi Nakamura',
    arquivo,
    tamanho_bytes: 6_200_000,
    origem: 'gestao',
    formato: 'empresas',
    ano: 2027,
    versao_nome: 'B27 - Ciclo 1 - v2',
    tipos,
    empresas,
    totais: somaEmpresas(empresas),
    liberacao: 'aguardando',
    ...liberacao,
    exemplo: true,
  })

  return [
    // Tudo em ordem: essencial e ideal verdes, liberado.
    linha('exemplo-1', 'Template Budget 2027 - LogRisk', logrisk, {
      receita: info(180, { caixa: 66_000_000 }),
      despesa: info(190, { caixa: 46_000_000 }),
      capex: info(40, { caixa: 3_100_000 }),
    }, 2),
    // Essencial ok, mas falta preencher campos do Ideal: pendência.
    linha('exemplo-2', 'Template Budget 2027 - BRK', brk, {
      receita: info(520, { vazios: { mrr: 120, cliente: 60 }, caixa: 173_000_000 }),
      despesa: info(380, { vazios: { subpacote: 95 }, caixa: 95_000_000 }),
      capex: info(80, { caixa: 6_000_000 }),
    }, 5),
    linha(
      'exemplo-3',
      'Template Budget 2027 - Buonny',
      buonny,
      {
        receita: info(150, { vazios: { cliente: 40 }, caixa: 20_000_000 }),
        despesa: info(95, { vazios: { subpacote: 30 }, caixa: 14_500_000 }),
      },
      26,
      {
        liberacao: 'liberado',
        liberado_por: 'ricardo.battistuta@nstech.com.br',
        liberado_em: new Date(Date.now() - 20 * 36e5).toISOString(),
      }
    ),
  ]
}
