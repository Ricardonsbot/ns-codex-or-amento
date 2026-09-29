import { supabase } from './supabaseClient'
import { amarracaoDisponivel, historicoDisponivel, listarImportacoes } from './importacoesData'

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
    id: 'sinal',
    titulo: 'Gasto lançado como positivo',
    rigor: 'qualquer',
    regra:
      'No template, gasto e capex são escritos como negativo. Linha positiva entra no P&L reduzindo a despesa — e a ferramenta não conserta o sinal sozinha: ela aponta a linha, porque quem sabe se aquilo é erro de digitação ou um crédito de verdade é quem lançou.',
    fonte: 'Convenção do Template Budget · Base Gastos e Capex (a leitura nega o valor, não tira o módulo)',
    escopo: (l) => l.tipo !== 'receita',
    conforme: (l) => l.valor >= 0,
    motivo: (l) => {
      const pista = PISTA_CREDITO.exec(livre(l))
      return pista
        ? `positivo no template · o texto diz "${pista[0]}" — pode ser crédito, confira`
        : 'positivo no template · gasto deveria vir negativo'
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

/**
 * Palavras que explicam um gasto positivo. Não decidem nada — só põem na
 * frente de quem confere o que a própria linha diz, para separar o estorno
 * legítimo do sinal digitado errado.
 */
const PISTA_CREDITO = /estorno|credito|reembolso|devoluc|recuperac|glosa|cancelament|ressarcim|abatiment/

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
function bandeira(nEscopo, valorFora, valorEscopo, rigor) {
  if (!nEscopo) return 'cinza'
  if (!valorFora) return 'verde'
  // Regra de rigor "qualquer": uma linha já é vermelho. Vale para o sinal
  // invertido, que num universo de milhares de linhas de gasto nunca chegaria
  // a 5% do valor e ficaria amarelo para sempre.
  if (rigor === 'qualquer') return 'vermelho'
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
    // Cada linha do escopo sai carimbada com o que aconteceu com ela. A tela
    // mostra tanto só as reprovadas quanto o conjunto inteiro: sem ver o que
    // passou não dá para saber se o check olhou o que devia.
    const avaliadas = [
      ...dentro.map((l) => ({ ...l, estado: r.conforme(l) ? 'ok' : 'fora', motivo: r.conforme(l) ? null : porQue(r, l) })),
      ...dispensadas.map((l) => ({ ...l, estado: 'dispensada', motivo: 'exceção da própria regra' })),
    ]
    const fora = avaliadas.filter((l) => l.estado === 'fora')
    const valorEscopo = valorDe(dentro)
    const valorFora = valorDe(fora)
    return {
      id: r.id,
      titulo: r.titulo,
      regra: r.regra,
      fonte: r.fonte,
      area: r.area ?? null,
      linhas: avaliadas,
      fora,
      nDispensadas: dispensadas.length,
      nEscopo: dentro.length,
      nFora: fora.length,
      valorEscopo,
      valorFora,
      medida: r.medida ? { rotulo: r.medida.rotulo, valor: r.medida.calcular(dentro) } : null,
      cor: bandeira(dentro.length, valorFora, valorEscopo, r.rigor),
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
  const [completo, comArquivo] = await Promise.all([sondarTemplate(), amarracaoDisponivel()])
  const campos =
    'id, tipo, descricao, fornecedor, area, empresa_id, empresa:empresa_id(nome), ' +
    'bu:bu_id(nome), torre:torre_id(nome), sub_torre:sub_torre_id(nome), ' +
    'conta:conta_id(codigo, nome, linha_pl), lancamento_valor_mensal(valor)' +
    (completo
      ? ', pacote, subpacote, area_ajustada, linha_pl_template, detalhamento, centro_custo_nome, torre_texto, diretoria'
      : '') +
    (comArquivo ? ', importacao_id' : '')

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
    importacaoId: l.importacao_id ?? null,
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
    // A torre do cadastro manda sobre a escrita no template: é ela que a
    // estrutura organizacional conhece. O texto do template fica de reserva
    // para quando a empresa ainda não está amarrada a uma torre.
    bu: l.bu?.nome ?? '',
    torre: l.torre?.nome || l.torre_texto || '',
    subTorre: l.sub_torre?.nome ?? '',
    diretoria: l.diretoria ?? '',
    valor: (l.lancamento_valor_mensal ?? []).reduce((a, v) => a + Number(v.valor ?? 0), 0),
  }))
}

/**
 * Quantos lançamentos cada versão do ciclo tem.
 *
 * A tela usa isso para abrir já numa versão que tenha dado: a versão de
 * referência do ciclo pode estar vazia (o Budget Base 2026, por exemplo), e
 * aí o Deep Dive abria dizendo "nenhum lançamento" como se não houvesse nada
 * a conferir no ano inteiro.
 */
export async function contarPorVersao(versoes) {
  const pares = await Promise.all(
    (versoes ?? []).map(async (v) => {
      const { count, error } = await supabase
        .from('lancamento')
        .select('id', { count: 'exact', head: true })
        .eq('versao_id', v.id)
      return [v.id, error ? 0 : count ?? 0]
    })
  )
  return new Map(pares)
}

/**
 * Os templates importados nesta versão: arquivo, quem subiu, quando e a
 * liberação. Devolve também por que a lista pode vir vazia — a tela diz isso
 * em vez de fingir que não há arquivo nenhum.
 */
export async function fetchTemplatesImportados(versaoId) {
  const [temHistorico, temAmarracao] = await Promise.all([historicoDisponivel(), amarracaoDisponivel()])
  if (!temHistorico || !temAmarracao) return { registros: [], temHistorico, temAmarracao }
  const todos = await listarImportacoes(300)
  return { registros: todos.filter((r) => r.versao_id === versaoId), temHistorico, temAmarracao }
}

/**
 * Por onde dá para abrir a conferência. São as colunas de texto do
 * lançamento — o mesmo conjunto que o template preenche —, mais a hierarquia
 * do cadastro: empresa, torre e BU.
 *
 * "Template" não é campo: é o arquivo que trouxe a linha, e tem regra
 * própria (ver `agruparTemplates`).
 */
export const DIMENSOES = [
  { valor: 'template', rotulo: 'Template' },
  { valor: 'empresa', rotulo: 'Empresa' },
  { valor: 'torre', rotulo: 'Torre' },
  { valor: 'bu', rotulo: 'BU' },
  { valor: 'subTorre', rotulo: 'Sub-torre' },
  { valor: 'diretoria', rotulo: 'Diretoria' },
  { valor: 'centro_custo_nome', rotulo: 'Centro de custo' },
  { valor: 'pacote', rotulo: 'Pacote' },
  { valor: 'subpacote', rotulo: 'Subpacote' },
  { valor: 'area', rotulo: 'Área' },
  { valor: 'conta_nome', rotulo: 'Conta' },
  { valor: 'fornecedor', rotulo: 'Fornecedor' },
]

/** O valor de uma dimensão numa linha. A área é a resolvida, não a crua. */
export function valorDaDimensao(l, dim) {
  if (dim === 'area') return areaDe(l) ?? ''
  return String(l[dim] ?? '').trim()
}

/**
 * Abre a conferência por uma dimensão qualquer: cada valor distinto vira um
 * item da lista, com os onze checks rodados só nas linhas dele.
 *
 * O grupo vazio não é escondido — "Sem pacote" costuma ser o maior problema
 * da base, e some se a gente só listar quem preencheu.
 */
export function agruparPorDimensao(linhas, dim) {
  const rotulo = DIMENSOES.find((d) => d.valor === dim)?.rotulo ?? dim
  const grupos = new Map()
  for (const l of linhas) {
    const chave = valorDaDimensao(l, dim)
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave).push(l)
  }
  return [...grupos.entries()]
    .map(([chave, doGrupo]) =>
      montarTemplate(
        {
          id: `${dim}:${chave}`,
          origem: 'dimensao',
          nome: chave || `Sem ${rotulo.toLowerCase()}`,
          detalhe: `${doGrupo.length.toLocaleString('pt-BR')} linha(s)`,
        },
        doGrupo
      )
    )
    .sort((a, b) => b.valorFora - a.valorFora || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Monta um item da lista: o recorte, os checks dele e a bandeira. */
function montarTemplate(base, linhas) {
  const checks = rodarChecks(linhas)
  return {
    ...base,
    linhas,
    checks,
    cor: piorCor(checks),
    nFora: checks.reduce((a, c) => a + c.nFora, 0),
    valorFora: checks.reduce((a, c) => a + c.valorFora, 0),
  }
}

const quando = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : null)

/** Os valores distintos de um campo, sem vazio e em ordem. */
const distintos = (linhas, campo) =>
  [...new Set(linhas.map((l) => (l[campo] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

/**
 * O nome do template.
 *
 * Não dá para usar o nome do arquivo: em 2027 todo mundo preenche o mesmo
 * "Template Budget 2027_Full", e a lista viria com vinte itens de nome
 * idêntico. Quem identifica é o que veio dentro — a empresa, quando é uma
 * só; a torre, quando o arquivo é de uma torre inteira. O nome do arquivo
 * continua logo abaixo, na linha do detalhe.
 */
function nomeDoConjunto(linhas) {
  const empresas = distintos(linhas, 'empresa')
  if (empresas.length === 1) return empresas[0]
  if (empresas.length === 2) return empresas.join(' + ')
  const torres = distintos(linhas, 'torre')
  if (torres.length === 1) return `${torres[0]} · ${empresas.length} empresas`
  if (torres.length > 1 && torres.length <= 3) return `${torres.join(' + ')} · ${empresas.length} empresas`
  return `${empresas.length} empresas`
}

/**
 * A lista de templates da esquerda.
 *
 * Um template é o arquivo que alguém subiu — é o que uma pessoa preenche,
 * corrige e reenvia, e é por arquivo que se devolve. O lançamento sabe de
 * qual arquivo veio pela coluna `importacao_id` (migração 2026-09-29).
 *
 * O que ficou sem arquivo — importado antes dessa amarração existir, ou por
 * um caminho que não registrou histórico — não some da tela: vira um item
 * por empresa, marcado como tal. Some-los num "outros" esconderia a maior
 * parte da base enquanto a migração não roda.
 *
 * Ordena pelo valor fora da regra: quem abre a tela quer o que mais dói.
 */
export function agruparTemplates(linhas, registros = []) {
  const usadas = new Set()
  const porArquivo = []

  for (const r of registros) {
    const doArquivo = linhas.filter((l) => l.importacaoId === r.id)
    if (!doArquivo.length) continue
    for (const l of doArquivo) usadas.add(l.id)
    const tipos = Object.keys(r.tipos ?? {}).filter((t) => !r.tipos[t]?.desfeito)
    porArquivo.push(
      montarTemplate(
        {
          id: r.id,
          origem: 'arquivo',
          nome: nomeDoConjunto(doArquivo),
          detalhe: [r.arquivo, quando(r.criado_em), r.usuario_nome || r.usuario_email, tipos.join(' + ')]
            .filter(Boolean)
            .join(' · '),
          liberacao: r.liberacao ?? 'aguardando',
        },
        doArquivo
      )
    )
  }

  const soltas = linhas.filter((l) => !usadas.has(l.id))
  const porEmpresa = new Map()
  for (const l of soltas) {
    const chave = l.empresaId ?? l.empresa
    if (!porEmpresa.has(chave)) porEmpresa.set(chave, [])
    porEmpresa.get(chave).push(l)
  }

  const semArquivo = [...porEmpresa.entries()].map(([chave, doGrupo]) =>
    montarTemplate(
      { id: `empresa:${chave}`, origem: 'empresa', nome: doGrupo[0].empresa, detalhe: 'sem arquivo registrado' },
      doGrupo
    )
  )

  const porDor = (a, b) => b.valorFora - a.valorFora || a.nome.localeCompare(b.nome, 'pt-BR')
  return [...porArquivo.sort(porDor), ...semArquivo.sort(porDor)]
}
