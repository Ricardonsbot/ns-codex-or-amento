import * as XLSX from 'xlsx'
import { lim } from './lerTemplateOrcamento'

/**
 * Os quatro templates que rodam no ciclo de budget.
 *
 * Todos chegam pela mesma tela e pela mesma caixa de upload, mas não são a
 * mesma coisa: mudam as abas que o arquivo traz, quem responde por ele e, no
 * caso do Pacoteiros, até o destino do número — target, não lançamento.
 * Tratar os quatro como um só era o que fazia a conferência cobrar Receita de
 * quem nunca teve receita e aceitar em silêncio um arquivo com a metade das
 * abas.
 *
 * `tipos` são as abas de lançamento que a Gestão de Importação vai conferir;
 * `exigidas`, as que sem elas o arquivo está errado. `destino` diz para onde
 * o número vai: 'lancamento' segue o caminho de sempre, 'target' vai para o
 * quadro Target × Bottom Up.
 */
export const FORMATOS = {
  empresas: {
    id: 'empresas',
    rotulo: 'Empresas',
    quem: 'FP&A de cada empresa',
    entrega: 'Receita, gasto e capex da empresa, ano cheio.',
    destino: 'lancamento',
    tipos: ['receita', 'despesa', 'capex'],
    exigidas: ['receita', 'despesa'],
    icone: '🏢',
  },
  'corporate-non-labor': {
    id: 'corporate-non-labor',
    rotulo: 'Corporate · Non Labor',
    quem: 'FP&A Corporate',
    entrega: 'Gasto corporativo fora de pessoal, com o realizado do ano anterior ao lado.',
    destino: 'lancamento',
    tipos: ['despesa', 'capex'],
    exigidas: ['despesa'],
    // O histórico vem em um bloco de meses do ano anterior. Ele não entra como
    // lançamento — o ano passado já está no realizado —, serve de referência
    // na hora de conferir.
    historico: true,
    icone: '🏛️',
  },
  'corporate-labor': {
    id: 'corporate-labor',
    rotulo: 'Corporate · Labor',
    quem: 'FP&A Corporate com RH',
    entrega: 'Folha corporativa por centro de custo.',
    destino: 'lancamento',
    tipos: ['despesa'],
    exigidas: ['despesa'],
    icone: '👥',
  },
  pacoteiros: {
    id: 'pacoteiros',
    rotulo: 'Pacoteiros',
    quem: 'o dono de cada pacote',
    entrega: 'O teto do ano por pacote — o target que o bottom up tem de caber.',
    destino: 'target',
    tipos: [],
    exigidas: [],
    icone: '🎯',
  },
}

export const ORDEM_FORMATOS = ['empresas', 'corporate-non-labor', 'corporate-labor', 'pacoteiros']

/** Nomes de aba que só aparecem no template de pacoteiro. */
export const ABAS_TARGET = ['TARGET', 'TARGETS', 'PACOTEIRO', 'PACOTEIROS', 'TARGET POR PACOTE', 'TETO POR PACOTE']

/**
 * De qual formato é o arquivo, pelo nome e pelas abas.
 *
 * O nome do arquivo decide primeiro: é o que a pessoa controla, e os quatro
 * templates de gasto têm abas parecidas demais para separar só pela estrutura.
 * Depois vem a aba de target, que não existe em nenhum outro; e por último a
 * presença da aba Receita, que só o template de Empresas tem.
 *
 * Devolve `{ formato, porque, certeza }`. Sem certeza a tela pergunta em vez
 * de decidir sozinha: importar como o formato errado cobra o checklist errado.
 */
export function detectarFormato(nomesDeAba = [], arquivo = '') {
  const abas = new Set(nomesDeAba.map(lim))
  const nome = lim(arquivo)
  const temTarget = ABAS_TARGET.some((a) => abas.has(a))

  if (/PACOTEIRO/.test(nome) || temTarget) {
    return { formato: 'pacoteiros', porque: temTarget ? 'tem aba de target por pacote' : 'o nome do arquivo diz pacoteiro', certeza: true }
  }
  // "NON LABOR" antes de "LABOR": um contém o outro.
  if (/NON LABOR/.test(nome)) return { formato: 'corporate-non-labor', porque: 'o nome do arquivo diz non labor', certeza: true }
  if (/LABOR|FOLHA|HEADCOUNT/.test(nome)) return { formato: 'corporate-labor', porque: 'o nome do arquivo diz labor', certeza: true }
  if (/CORPORATE|CORPORATIVO/.test(nome)) {
    return { formato: 'corporate-non-labor', porque: 'o nome diz corporate e não separa labor', certeza: false }
  }
  if (abas.has('RECEITA')) return { formato: 'empresas', porque: 'tem a aba Receita', certeza: true }
  return { formato: 'empresas', porque: 'não deu para distinguir pelo nome nem pelas abas', certeza: false }
}

/** Só os nomes das abas, sem parsear nenhuma delas. */
export function nomesDasAbas(arrayBuffer) {
  return XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', bookSheets: true }).SheetNames ?? []
}

/**
 * O que não bate entre o arquivo e o formato escolhido: aba exigida que veio
 * vazia ou com erro, e aba de sobra. É aviso, não impedimento — quem escolheu
 * o formato foi a pessoa, e ela pode ter razão.
 */
export function conferirFormato(formatoId, lidos) {
  const f = FORMATOS[formatoId]
  if (!f || !lidos) return { faltando: [], sobrando: [] }
  const comDado = (t) => Boolean(lidos[t] && !lidos[t].erro && lidos[t].linhas.length)
  return {
    faltando: f.exigidas.filter((t) => !comDado(t)),
    sobrando: ['receita', 'despesa', 'capex'].filter((t) => comDado(t) && !f.tipos.includes(t)),
  }
}
