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

export function medirLinhas(linhas, tipo, cadastros) {
  let semArea = 0
  let sinaisTrocados = 0
  // Linha do P&L: a da conta no plano é a que manda. Duas coisas podem dar
  // errado — a conta cair numa linha que a Master não conhece (o valor some
  // do P&L) e a coluna "Linha P&L" do template discordar do plano.
  let plDesconhecida = 0
  let plDivergente = 0
  const plExemplos = []
  const meses = new Map() // empresa -> 12 bandeiras de "tem valor"

  for (const p of linhas) {
    const total = p.total ?? soma(p.valores)
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
 * O checklist do template importado. Cada item é
 * { chave, nivel, rotulo, ok, detalhe }:
 *
 *   vermelho  o número sai errado ou incompleto — não dá para consolidar
 *   amarelo   entra, mas alguém precisa olhar
 *
 * É aqui que se mexe quando a régua do FP&A mudar. Serve tanto para a tela
 * que aparece logo depois de importar quanto para a lista do histórico: as
 * duas montam o mesmo objeto de registro.
 *
 * `escopo` 'tipo' é o checklist de UMA importação (o card de Receita, por
 * exemplo): ali não faz sentido cobrar que os três tipos tenham entrado, que
 * é coisa do arquivo inteiro.
 */
export function checklist(registro, escopo = 'arquivo') {
  const tipos = registro?.tipos ?? {}
  const t = registro?.totais ?? {}
  const ROTULO = { receita: 'Receita', despesa: 'Despesa', capex: 'Capex' }
  const usados = Object.keys(ROTULO).filter((x) => tipos[x])
  const faltando = Object.keys(ROTULO).filter((x) => !tipos[x])
  const somar = (campo) => usados.reduce((a, x) => a + (tipos[x]?.[campo] ?? 0), 0)
  const algum = (campo) => usados.some((x) => tipos[x]?.[campo])

  const linhas = somar('linhas')
  const fora = somar('fora')
  const marcadas = somar('marcadas')
  const semArea = somar('semArea')
  const mesesVazios = somar('mesesVazios')
  const sinaisTrocados = somar('sinaisTrocados')
  const plDesconhecida = somar('plDesconhecida')
  const plDivergente = somar('plDivergente')
  const plExemplos = usados.flatMap((x) => tipos[x]?.plExemplos ?? []).slice(0, 3)
  const desfeitos = usados.filter((x) => tipos[x]?.desfeito)
  const comDeducao = Math.abs(t.nr ?? 0) < Math.abs(t.gr ?? 0)
  const margem = t.nr ? ((t.nr - (t.despesa ?? 0)) / t.nr) * 100 : null
  const item = (chave, nivel, rotulo, ok, detalhe) => ({ chave, nivel, rotulo, ok, detalhe })
  const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`

  const itens = [
    item(
      'empresas',
      'vermelho',
      'Empresas do arquivo cadastradas',
      fora === 0,
      fora ? `${plural(fora, 'linha ficou', 'linhas ficaram')} de fora — empresa não cadastrada` : `todas as ${linhas} linhas entraram`
    ),
    item(
      'contas',
      'vermelho',
      'Contas no plano de contas',
      marcadas === 0,
      marcadas ? `${plural(marcadas, 'linha entrou', 'linhas entraram')} sem conta — ficam fora do P&L` : 'todas as contas existem no plano'
    ),
    item(
      'area',
      'vermelho',
      'Área de alocação preenchida',
      semArea === 0,
      semArea
        ? `${plural(semArea, 'linha de gasto', 'linhas de gasto')} sem área — não viram CoGS, G&A, S&M nem R&D`
        : 'todo gasto tem área'
    ),
    item(
      'linhaPl',
      'vermelho',
      'Linha do P&L reconhecida',
      plDesconhecida === 0,
      plDesconhecida
        ? `${plural(plDesconhecida, 'linha cai', 'linhas caem')} numa linha do P&L que a Master não tem${
            plExemplos.length ? ` — ex.: ${plExemplos.join(', ')}` : ''
          }`
        : 'toda conta cai numa linha da Master'
    ),
    item(
      'sinais',
      'vermelho',
      'Sinais do valor',
      sinaisTrocados === 0,
      sinaisTrocados
        ? `${plural(sinaisTrocados, 'linha', 'linhas')} com o sinal trocado — o valor entra invertido no P&L`
        : 'receita e gasto positivos'
    ),
    item(
      'destino',
      'vermelho',
      'Ciclo e versão de destino',
      Boolean(registro?.ano && registro?.versao_nome),
      registro?.ano && registro?.versao_nome ? `${registro.ano} · ${registro.versao_nome}` : 'destino incompleto'
    ),
    item(
      'duplicidade',
      'vermelho',
      'Sem duplicidade',
      !algum('somouEmCima'),
      algum('somouEmCima')
        ? 'a versão já tinha lançamentos deste tipo e a importação somou — confira se dobrou'
        : 'não somou em cima de lançamento que já existia'
    ),
    item(
      'desfeito',
      'vermelho',
      'Importação em pé',
      desfeitos.length === 0,
      desfeitos.length ? `${desfeitos.map((x) => ROTULO[x]).join(', ')} desfeito(s) depois` : 'nada foi desfeito'
    ),

    item(
      'tipos',
      'amarelo',
      'Receita, Despesa e Capex no arquivo',
      faltando.length === 0,
      faltando.length ? `só veio ${usados.map((x) => ROTULO[x]).join(', ')} — envio parcial?` : 'os três entraram'
    ),
    item(
      'deducao',
      'amarelo',
      'Dedução na receita',
      !tipos.receita || comDeducao,
      !tipos.receita
        ? 'sem receita neste arquivo'
        : comDeducao
        ? 'Net Revenue menor que a Gross Revenue'
        : 'Net Revenue igual à Gross Revenue — margem sai otimista'
    ),
    item(
      'meses',
      'amarelo',
      'Doze meses por empresa',
      mesesVazios === 0,
      mesesVazios ? `${plural(mesesVazios, 'empresa tem', 'empresas têm')} mês em branco` : 'nenhum buraco de mês'
    ),
    item(
      'linhaPlTemplate',
      'amarelo',
      'Linha do P&L igual à do plano',
      plDivergente === 0,
      plDivergente
        ? `${plural(plDivergente, 'linha traz', 'linhas trazem')} no template uma Linha P&L diferente da conta no plano — vale a do plano`
        : 'template e plano de contas dizem a mesma coisa'
    ),
    item(
      'margem',
      'amarelo',
      'Margem plausível',
      margem === null || (margem > -20 && margem < 70),
      margem === null
        ? 'sem receita para calcular'
        : `EBITDA/NR de ${margem.toFixed(1)}%${margem > 70 || margem < -20 ? ' — confira a classificação' : ''}`
    ),
    ...itensDeCadastro(tipos, usados),
  ]
  return escopo === 'tipo' ? itens.filter((i) => i.chave !== 'tipos') : itens
}

/**
 * Nome e peso de cada dimensão de cadastro no checklist. Centro de custo é
 * vermelho: é por ele que o gasto é cobrado de quem responde pela área, e um
 * centro que não existe no cadastro não tem dono.
 */
const CADASTRO = {
  centroCusto: { rotulo: 'Centros de custo cadastrados', nivel: 'vermelho' },
  fornecedor: { rotulo: 'Fornecedores cadastrados', nivel: 'amarelo' },
  produto: { rotulo: 'Produtos cadastrados', nivel: 'amarelo' },
  cliente: { rotulo: 'Clientes cadastrados', nivel: 'amarelo' },
  diretoria: { rotulo: 'Diretorias cadastradas', nivel: 'amarelo' },
}

/**
 * Um item por dimensão que o arquivo realmente traz. Dimensão que o template
 * não preenche, ou cadastro que ainda não existe como tabela, não vira item —
 * um checklist cheio de "não se aplica" não ajuda ninguém.
 */
function itensDeCadastro(tipos, usados) {
  return Object.entries(CADASTRO)
    .map(([chave, { rotulo, nivel }]) => {
      const partes = usados.map((x) => tipos[x]?.cadastros?.[chave]).filter(Boolean)
      if (!partes.length) return null
      const linhas = partes.reduce((a, x) => a + x.linhas, 0)
      const exemplos = partes.flatMap((x) => x.exemplos ?? []).slice(0, 3)
      return {
        chave: `cad-${chave}`,
        nivel,
        rotulo,
        ok: linhas === 0,
        detalhe: linhas
          ? `${linhas} linha(s) com valor fora do cadastro${exemplos.length ? ` — ex.: ${exemplos.join(', ')}` : ''}`
          : 'todos os valores existem no cadastro',
      }
    })
    .filter(Boolean)
}

/**
 * Verde quando tudo passa; vermelho quando falha algum item vermelho; amarelo
 * quando só os de atenção falharam.
 */
export function flagDo(registro, escopo = 'arquivo') {
  const itens = checklist(registro, escopo)
  if (itens.some((i) => !i.ok && i.nivel === 'vermelho')) return 'vermelho'
  if (itens.some((i) => !i.ok)) return 'amarelo'
  return 'verde'
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
  const info = (linhas, fora = 0, marcadas = 0) => ({ linhas, total: 0, apagados: 0, fora, marcadas, desfeito: false })

  const completas = [
    empresa('Opentech', 1240, 195_100_000, 112_300_000, 8_400_000),
    empresa('BRK', 980, 184_400_000, 95_500_000, 6_100_000),
  ]
  const pendente = [empresa('LogRisk', 410, 70_500_000, 46_500_000, 3_200_000)]

  return [
    {
      id: 'exemplo-1',
      criado_em: new Date(Date.now() - 36e5).toISOString(),
      usuario_email: 'fpa@nstech.com.br',
      usuario_nome: 'Exemplo — FP&A',
      arquivo: 'Template Budget 2027 v3.xlsb',
      tamanho_bytes: 9_400_000,
      origem: 'gestao',
      ano: 2027,
      versao_nome: 'Original',
      tipos: { receita: info(1100), despesa: info(950), capex: info(170) },
      empresas: completas,
      totais: somaEmpresas(completas),
      exemplo: true,
    },
    {
      id: 'exemplo-2',
      criado_em: new Date(Date.now() - 3 * 864e5).toISOString(),
      usuario_email: 'controladoria@nstech.com.br',
      usuario_nome: 'Exemplo — Controladoria',
      arquivo: 'Template Budget 2027 LogRisk.xlsx',
      tamanho_bytes: 4_100_000,
      origem: 'despesa',
      ano: 2027,
      versao_nome: 'Original',
      tipos: { despesa: info(410, 12, 7) },
      empresas: pendente,
      totais: somaEmpresas(pendente),
      exemplo: true,
    },
  ]
}
