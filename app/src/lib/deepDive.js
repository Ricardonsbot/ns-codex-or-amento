import { supabase } from './supabaseClient'

/**
 * Deep Dive: a conferência das regras de classificação do orçamento.
 *
 * As regras não foram inventadas aqui — estão escritas na coluna Observação
 * do Plano de Contas do Template Budget ("Sempre COGS exceto para
 * Corporate/Projetos", "Não contempla notebook ou equipamentos de TI",
 * "Eventos com clientes (não contempla eventos internos)"...). Cada uma
 * virou um check, e o texto original vai junto na tela: quem discorda da
 * cobrança discute com o plano de contas, não com a ferramenta.
 *
 * O que liga tudo é que **a conta não define a área**. A área é campo próprio
 * da Base Gastos (Alocação PnL, e a ajustada quando existe), e é ela que joga
 * o gasto em COGS, G&A, S&M ou R&D. Quase todo check é um par
 * conta/pacote/fornecedor ↔ área que deveria andar junto.
 *
 * Um check olha só o que é dele: se o recorte não tem nenhuma linha daquela
 * conta, ele fica cinza ("nada para conferir") em vez de verde — verde só
 * quando houve o que conferir e passou.
 */

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** O código da conta só em dígitos: o template ora escreve com ponto, ora sem. */
const cod = (l) => String(l.conta_codigo ?? '').replace(/\D/g, '')

/** Conta pelo código; as contas novas do template ainda vêm como "NOVO". */
const contaEh = (l, ...codigos) => codigos.includes(cod(l))

/** Tudo que o preenchedor escreveu na linha, para procurar palavra solta. */
const livre = (l) =>
  norm([l.detalhamento, l.fornecedor, l.descricao, l.centro_custo_nome, l.subpacote].filter(Boolean).join(' · '))

/**
 * A área do P&L da linha, nas quatro da Master. A ajustada manda quando
 * existe — é a coluna "Alocação PnL Ajustado", que serve justamente para
 * corrigir o que veio errado do ERP.
 */
export function areaDe(l) {
  const a = String(l.area_ajustada || l.area || '')
    .toUpperCase()
    .trim()
  if (a.startsWith('COGS') || a.startsWith('COG')) return 'COGS'
  if (a.startsWith('G&A') || a.startsWith('GA')) return 'G&A'
  if (a.startsWith('S&M') || a.startsWith('SM')) return 'S&M'
  if (a.startsWith('R&D') || a.startsWith('RD')) return 'R&D'
  return a || null
}

const ehArea = (l, alvo) => areaDe(l) === alvo

/**
 * A linha é de Corporate ou de Projetos? É a exceção que o plano de contas
 * abre para o Cloud, e vem da estrutura (torre/diretoria/centro de custo),
 * não da conta.
 */
const corporateOuProjetos = (l) =>
  /corporate|corporativ|projeto/.test(norm([l.torre, l.diretoria, l.centro_custo_nome, l.empresa].join(' ')))

/** Gasto de pessoal, pela Linha P&L do template (a mesma regra do Resultado). */
const ehLabor = (l) => {
  const t = norm(l.linha_pl_template)
  if (/non[\s-]*labor/.test(t)) return false
  return /labor/.test(t) || t === 'employee'
}

/**
 * As onze regras, na ordem em que o FP&A as anotou.
 *
 *   escopo    quais linhas a regra olha
 *   conforme  a linha obedece?
 *   dispensa  linha que a própria regra excetua (não conta como erro nem
 *             como acerto: sai da conferência)
 *   medida    um número que acompanha o check, quando a regra é sobre
 *             proporção e não sobre certo/errado
 */
export const REGRAS = [
  {
    id: 'cloud',
    titulo: 'Cloud em COGS',
    area: 'COGS',
    regra: 'Sempre COGS, exceto para Corporate/Projetos.',
    fonte: 'Plano de Contas · GASTOS COM NUVEM (4.7.03.004.007)',
    escopo: (l) => contaEh(l, '4703004007') || norm(l.subpacote) === 'cloud' || /nuvem|cloud/.test(nomeConta(l)),
    dispensa: corporateOuProjetos,
    conforme: (l) => ehArea(l, 'COGS'),
    medida: {
      rotulo: '% do Cloud em COGS',
      calcular: (dentro) => parte(dentro.filter((l) => ehArea(l, 'COGS')), dentro),
    },
  },
  {
    id: 'pronta-resposta',
    titulo: 'Pronta resposta em COGS',
    area: 'COGS',
    regra: 'Serviço de pronta resposta e acompanhamento velado é custo do serviço prestado.',
    fonte: 'Plano de Contas · SERVICOS DE PRONTA RESP. E ACOMP. VELADO (4.7.03.002.006), abertura nova',
    // A conta nasce em 4.7.03.002 (serviços de terceiros), não em 4.7.02
    // (custo variável): é o caso clássico em que a conta engana e só a área
    // põe o gasto no lugar certo.
    escopo: (l) => contaEh(l, '4703002006') || /pronta resp/.test(nomeConta(l)) || /pronta resposta/.test(livre(l)),
    conforme: (l) => ehArea(l, 'COGS'),
  },
  {
    id: 'rastreamento',
    titulo: 'Rastreamento em COGS',
    area: 'COGS',
    regra: 'Rastreamento é COGS — e não pode estar escondido nas contas de telecom.',
    fonte: 'Plano de Contas · RASTREAMENTO VEICULAR (4.7.02.001.003) e CUSTO FORNECEDOR DE RASTREAMENTO; LINKS DE COMUNICACAO e TELECOMUNICACAO: "não contempla comunicação com equip. rastreamento"',
    escopo: (l) => ehRastreamento(l) || rastreamentoEmTelecom(l),
    conforme: (l) => ehRastreamento(l) && ehArea(l, 'COGS'),
    motivo: (l) => (rastreamentoEmTelecom(l) ? 'rastreamento lançado em conta de telecom' : null),
  },
  {
    id: 'mlog',
    titulo: 'Custo de evento MLOG em COGS',
    area: 'COGS',
    regra: 'Conta específica para os eventos da Mundo Logística, e o custo deles é COGS.',
    fonte: 'Plano de Contas · CUSTO EVENTOS MLOG, abertura nova: "específico para eventos Mlog - COGS"',
    escopo: (l) => /eventos? m\s?log/.test(nomeConta(l)) || /custo eventos mlog/.test(norm(l.subpacote)),
    conforme: (l) => ehArea(l, 'COGS'),
  },
  {
    id: 'cadastro',
    titulo: 'Custo de cadastro em COGS',
    area: 'COGS',
    regra: 'Custo de fornecedor de cadastro é custo variável do serviço, como rastreamento e comunicação.',
    fonte: 'Plano de Contas · CUSTO FORNECEDOR CADASTRO (4.7.02.001.005), abertura nova',
    escopo: (l) => contaEh(l, '4702001005') || /fornecedor cadastro/.test(nomeConta(l)),
    conforme: (l) => ehArea(l, 'COGS'),
  },
  {
    id: 'marketing',
    titulo: 'Marketing em S&M',
    area: 'S&M',
    regra: 'O subpacote Marketing, do pacote Growth Investments, é despesa comercial.',
    fonte: 'Mapa Fornecedores · pacote Growth Investments → subpacote Marketing',
    escopo: (l) => norm(l.subpacote) === 'marketing' || /publicidade|propaganda|marketing/.test(nomeConta(l)),
    conforme: (l) => ehArea(l, 'S&M'),
  },
  {
    id: 'comissoes',
    titulo: 'Comissões e corretagens em S&M',
    area: 'S&M',
    regra: 'Comissão de finders — terceiros. Comissão da equipe de vendas é folha, vai em COMISSOES (4.7.03.001.014).',
    fonte: 'Plano de Contas · COMISSOES E CORRETAGENS (4.7.03.002.007): "Comissão Finders (são terceiros, não inclui equipe de vendas)"',
    escopo: (l) => contaEh(l, '4703002007') || norm(l.subpacote) === 'comissao finders',
    conforme: (l) => ehArea(l, 'S&M') && !ehLabor(l),
    motivo: (l) => (ehLabor(l) ? 'é folha (equipe de vendas): vai em COMISSOES, 4.7.03.001.014' : null),
  },
  {
    id: 'juridico',
    titulo: 'Jurídico em G&A',
    area: 'G&A',
    regra: 'Serviços jurídicos, processos e as provisões de contingência são G&A por padrão.',
    fonte: 'Plano de Contas · SERVICOS JURIDICOS (4.7.03.002.003) e contingências: "Por padrão, G&A"',
    escopo: (l) =>
      contaEh(l, '4703002003', '4703015013', '4703015014', '4703015016', '4703015018', '4703015024') ||
      norm(l.subpacote) === 'juridico',
    conforme: (l) => ehArea(l, 'G&A'),
  },
  {
    id: 'locacao-ti',
    titulo: 'Aluguel de computador em Locação de Equipamento de TI',
    regra: 'Notebook e equipamento de TI alugado vai na conta de TI, não em aluguel de máquinas e equipamentos.',
    fonte: 'Plano de Contas · ALUGUEL DE MAQUINAS E EQUIPAMENTOS (4.7.03.015.004): "Não contempla notebook ou equipamentos de TI"; Mapa Fornecedores amarra VOKE e POSITIVO ao subpacote Locação de Equipamento de TI',
    escopo: (l) => alugaEquipamento(l) && (fornecedorDeTi(l) || pareceComputador(l)),
    conforme: (l) => contaEh(l, '4703004004') || norm(l.subpacote) === 'locacao de equipamento de ti',
    motivo: () => 'equipamento de TI fora da conta 4.7.03.004.004',
  },
  {
    id: 'feiras-eventos',
    titulo: 'Só evento de marketing em Feiras e Eventos',
    area: 'S&M',
    regra: 'Evento com cliente. Evento interno (RH, integração, confraternização) vai em EVENTOS INTERNOS; evento da Mundo Logística, em CUSTO EVENTOS MLOG.',
    fonte: 'Plano de Contas · FEIRAS E EVENTOS (4.7.03.003.006): "Eventos com clientes (não contempla eventos internos)"; EVENTOS INTERNOS: "eventos com funcionários ou parceiros"',
    escopo: (l) => contaEh(l, '4703003006') || eventoEmHospedagem(l),
    conforme: (l) => contaEh(l, '4703003006') && ehArea(l, 'S&M') && !pareceInterno(l) && !pareceMlog(l),
    motivo: (l) => {
      if (eventoEmHospedagem(l)) return 'espaço de evento lançado em HOSPEDAGEM'
      if (pareceMlog(l)) return 'evento da Mundo Logística: vai em CUSTO EVENTOS MLOG'
      if (pareceInterno(l)) return 'evento interno: vai em EVENTOS INTERNOS, 4.7.03.003.009'
      return null
    },
  },
  {
    id: 'cyber',
    titulo: 'Cyber na conta de cyber e em R&D',
    area: 'R&D',
    regra: 'Seguro cyber tem conta própria; licença e serviço, outra. Nenhum dos dois mora em software genérico, e a área é R&D.',
    fonte: 'Plano de Contas · SEGUROS CYBER SECURITY (4.7.03.004.006): "Somente Seguro Cyber. Serviço em outra conta"; LICENCA OU SERVICO CYBER (4.7.03.004.008)',
    escopo: (l) => contaDeCyber(l) || (/cyber|seguranca da informacao/.test(livre(l)) && !contaDeCyber(l)),
    conforme: (l) => contaDeCyber(l) && ehArea(l, 'R&D') && !seguroTrocado(l),
    motivo: (l) => {
      if (!contaDeCyber(l)) return 'cyber fora das contas de cyber (4.7.03.004.006 e .008)'
      if (seguroTrocado(l)) return 'serviço ou licença na conta que é só de seguro'
      return null
    },
  },
  {
    id: 'ativacao',
    titulo: '% de ativação',
    regra: 'Em projetos em andamento, é o campo de área do P&L que diz se o gasto foi ativado. A conta contábil respeita a natureza original — então área em branco deixa o projeto sem definição.',
    fonte: 'Plano de Contas · PROJETOS EM ANDAMENTO (1.2.05.003.007): "Campo área P&L define se é ativação ou não"',
    escopo: (l) => contaEh(l, '1205003007') || /projetos? em andamento/.test(nomeConta(l)),
    conforme: (l) => Boolean(areaDe(l)),
    motivo: () => 'sem área do P&L: não dá para saber se foi ativado',
    medida: {
      rotulo: '% ativado',
      calcular: (dentro) => parte(dentro.filter(ehAtivacao), dentro),
    },
  },
]

// ---------------------------------------------------------------- auxiliares

const nomeConta = (l) => norm(l.conta_nome)

const ehRastreamento = (l) =>
  contaEh(l, '4702001003') || /rastreamento/.test(nomeConta(l)) || norm(l.subpacote) === 'fornecedor de gr'

/** Rastreamento lançado nas contas de telecom, que o plano de contas proíbe. */
const rastreamentoEmTelecom = (l) => contaEh(l, '4703004002', '4703004003') && /rastrea/.test(livre(l))

const alugaEquipamento = (l) =>
  contaEh(l, '4703015004', '4703007001', '4703002010', '4703004004') ||
  /aluguel|locacao/.test(nomeConta(l)) ||
  norm(l.subpacote) === 'locacao de equipamento de ti'

const fornecedorDeTi = (l) => /voke|positivo/.test(norm(l.fornecedor))

const pareceComputador = (l) => /notebook|computador|desktop|laptop|micro|monitor|estacao de trabalho/.test(livre(l))

const pareceInterno = (l) =>
  /interno|funcionari|colaborador|rh\b|gente e gestao|recursos humanos|integracao|confraterniz|endomarketing|treinamento/.test(
    livre(l)
  )

const pareceMlog = (l) => /mundo log|mlog|m log/.test(norm([l.empresa, l.detalhamento, l.centro_custo_nome].join(' ')))

/** Espaço de evento lançado em HOSPEDAGEM, que o plano manda ir para eventos. */
const eventoEmHospedagem = (l) => contaEh(l, '4703005005') && /evento|espaco/.test(livre(l))

const contaDeCyber = (l) => contaEh(l, '4703004006', '4703004008') || norm(l.subpacote) === 'cyber'

/** Serviço ou licença lançado na conta que é só de seguro. */
const seguroTrocado = (l) => contaEh(l, '4703004006') && /servic|licenc|consultor/.test(livre(l))

/** Ativado = virou Capex/Intangível, e não despesa do período. */
const ehAtivacao = (l) => l.tipo === 'capex' || /ativa/.test(norm(l.area_ajustada || l.area)) || /capex|intangible/.test(norm(l.linha_pl_template))

const valorDe = (linhas) => linhas.reduce((a, l) => a + Math.abs(Number(l.valor) || 0), 0)

const parte = (subconjunto, todos) => {
  const total = valorDe(todos)
  return total ? (valorDe(subconjunto) / total) * 100 : null
}

/**
 * A bandeira do check. Verde é "conferi e passou"; cinza é "não havia o que
 * conferir", que não é a mesma coisa e não pode virar elogio. Entre os dois,
 * o corte é pelo valor fora, não pela contagem: uma linha errada de R$ 2 mi
 * pesa mais que dez de R$ 200.
 */
function bandeira(nEscopo, valorFora, valorEscopo) {
  if (!nEscopo) return 'cinza'
  if (!valorFora) return 'verde'
  return valorFora / (valorEscopo || valorFora) > 0.05 ? 'vermelho' : 'amarelo'
}

/**
 * Por que esta linha caiu. O específico da regra vem primeiro; quando ela não
 * tem nada a dizer, sobra o caso comum — a área não é a que a regra pede.
 */
function porQue(regra, l) {
  const dito = regra.motivo?.(l)
  if (dito) return dito
  if (regra.area) return `área ${areaDe(l) ?? 'em branco'} — deveria ser ${regra.area}`
  return 'fora da regra'
}

/** Roda as onze regras sobre um conjunto de linhas. */
export function rodarChecks(linhas) {
  return REGRAS.map((r) => {
    const noEscopo = linhas.filter(r.escopo)
    const dispensadas = r.dispensa ? noEscopo.filter(r.dispensa) : []
    const dentro = r.dispensa ? noEscopo.filter((l) => !r.dispensa(l)) : noEscopo
    const fora = dentro.filter((l) => !r.conforme(l)).map((l) => ({ ...l, motivo: porQue(r, l) }))
    const valorEscopo = valorDe(dentro)
    const valorFora = valorDe(fora)
    return {
      id: r.id,
      titulo: r.titulo,
      regra: r.regra,
      fonte: r.fonte,
      area: r.area ?? null,
      linhas: dentro,
      fora,
      dispensadas: dispensadas.length,
      nEscopo: dentro.length,
      nFora: fora.length,
      valorEscopo,
      valorFora,
      medida: r.medida ? { rotulo: r.medida.rotulo, valor: r.medida.calcular(dentro) } : null,
      cor: bandeira(dentro.length, valorFora, valorEscopo),
    }
  })
}

/** O pior farol de um conjunto de checks — é a bandeira do template na lista. */
export function piorCor(checks) {
  if (checks.some((c) => c.cor === 'vermelho')) return 'vermelho'
  if (checks.some((c) => c.cor === 'amarelo')) return 'amarelo'
  if (checks.some((c) => c.cor === 'verde')) return 'verde'
  return 'cinza'
}

// ------------------------------------------------------------------- o banco

/**
 * As colunas do template existem? Vieram nas migrações 2026-09-10 e
 * 2026-09-22; sem elas o Deep Dive ainda roda, só com menos regra ao alcance.
 */
let temTemplate = null
async function sondarTemplate() {
  if (temTemplate !== null) return temTemplate
  const { error } = await supabase
    .from('lancamento')
    .select('pacote, subpacote, area_ajustada, linha_pl_template, detalhamento, centro_custo_nome, torre_texto, diretoria')
    .limit(1)
  temTemplate = !error
  return temTemplate
}

/**
 * Os lançamentos de uma versão, achatados no que os checks olham: um valor
 * por linha (a soma do ano), a conta, a área e o que o preenchedor escreveu.
 *
 * Pagina de mil em mil — o PostgREST corta aí e não avisa.
 */
export async function fetchDeepDive(versaoId) {
  const completo = await sondarTemplate()
  const campos =
    'id, tipo, descricao, fornecedor, area, empresa_id, empresa:empresa_id(nome), ' +
    'conta:conta_id(codigo, nome, linha_pl), lancamento_valor_mensal(valor)' +
    (completo
      ? ', pacote, subpacote, area_ajustada, linha_pl_template, detalhamento, centro_custo_nome, torre_texto, diretoria'
      : '')

  const brutas = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase
      .from('lancamento')
      .select(campos)
      .eq('versao_id', versaoId)
      .range(de, de + 999)
    if (error) throw error
    brutas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  return brutas.map((l) => ({
    id: l.id,
    tipo: l.tipo,
    empresaId: l.empresa_id ?? null,
    empresa: l.empresa?.nome ?? 'Sem empresa',
    conta_codigo: l.conta?.codigo ?? '',
    conta_nome: l.conta?.nome ?? '',
    linha_pl_template: l.linha_pl_template ?? l.conta?.linha_pl ?? '',
    area: l.area ?? '',
    area_ajustada: l.area_ajustada ?? '',
    pacote: l.pacote ?? '',
    subpacote: l.subpacote ?? '',
    fornecedor: l.fornecedor ?? '',
    detalhamento: l.detalhamento ?? '',
    descricao: l.descricao ?? '',
    centro_custo_nome: l.centro_custo_nome ?? '',
    torre: l.torre_texto ?? '',
    diretoria: l.diretoria ?? '',
    valor: (l.lancamento_valor_mensal ?? []).reduce((a, v) => a + Number(v.valor ?? 0), 0),
  }))
}

/**
 * Um "template" da lista é o que uma empresa mandou: na prática o arquivo de
 * uma empresa vira as linhas dela dentro da versão, e é esse o conjunto que
 * alguém corrige e reenvia. Vem ordenado pelo que tem mais gasto fora da
 * regra — quem abre a tela quer ver primeiro o que mais dói.
 */
export function agruparTemplates(linhas) {
  const porEmpresa = new Map()
  for (const l of linhas) {
    const chave = l.empresaId ?? l.empresa
    if (!porEmpresa.has(chave)) porEmpresa.set(chave, { id: chave, nome: l.empresa, linhas: [] })
    porEmpresa.get(chave).linhas.push(l)
  }
  const templates = [...porEmpresa.values()].map((t) => {
    const checks = rodarChecks(t.linhas)
    return {
      ...t,
      checks,
      cor: piorCor(checks),
      nFora: checks.reduce((a, c) => a + c.nFora, 0),
      valorFora: checks.reduce((a, c) => a + c.valorFora, 0),
    }
  })
  return templates.sort((a, b) => b.valorFora - a.valorFora || a.nome.localeCompare(b.nome, 'pt-BR'))
}
