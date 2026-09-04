import * as XLSX from 'xlsx'

/**
 * Leitura das abas de lançamento do Template Budget, para importação pela tela.
 *
 * As três abas têm o mesmo esqueleto: uma faixa de colunas de dimensão seguida
 * de blocos de 12 meses. O que muda é o nome da aba, o nome das colunas e
 * quantos blocos de mês vêm depois. Entra sempre o PRIMEIRO bloco:
 *
 *   Receita ...... bruta digitada  (depois vêm proporção, reajuste, deduções,
 *                  líquida — a dedução é linha própria do P&L e a ferramenta já
 *                  guarda as alíquotas, então gravar a líquida perderia a
 *                  dedução pelo caminho)
 *   Base Gastos .. competência     (depois vem o bloco de caixa)
 *   Capex ........ competência     (depois vem o bloco de caixa)
 *
 * Colunas são localizadas pelo texto do cabeçalho, nunca por índice: as abas
 * desta pasta começam fora da coluna A, e o SheetJS indexa a partir do início
 * do intervalo — índice fixo aponta para a coluna errada sem dar erro.
 */

const semAcento = (v) => String(v).normalize('NFD').replace(/\p{Diacritic}/gu, '')
export const lim = (v) => semAcento(v).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

const junta = (...partes) => partes.filter(Boolean).join(' · ')

/**
 * `ancora` é a célula que identifica a linha de cabeçalho. `exigidas` são as
 * colunas sem as quais a aba não é reconhecível — se faltarem, é melhor falhar
 * do que ler a planilha errada em silêncio.
 *
 * `sinal` converte a convenção da planilha para a do banco: o template escreve
 * gasto e capex como número negativo, e a ferramenta guarda a magnitude
 * (`ebitda = receita - despesa`). É negação, e não valor absoluto, para que um
 * crédito lançado no meio dos gastos continue reduzindo a despesa.
 */
export const TEMPLATE = {
  receita: {
    aba: 'Receita',
    ancora: 'TIPO RECEITA',
    exigidas: ['TIPO RECEITA', 'CONTA CONTABIL', 'EMPRESA', 'PRODUTO ANALITICO'],
    colEmpresa: 'EMPRESA',
    sinal: 1,
    monta: (t) => ({
      contaCodigo: '',
      contaRotulo: t('CONTA CONTABIL'),
      descricao: junta(t('PRODUTO ANALITICO') || t('PRODUTO SINTETICO'), t('TIPO RECEITA')),
      centroCusto: '',
      fornecedor: '',
      obs: [t('RAZAO SOCIAL CLIENTE') && `Cliente: ${t('RAZAO SOCIAL CLIENTE')}`, t('OBS')]
        .filter(Boolean)
        .join(' | '),
    }),
  },
  despesa: {
    aba: 'Base Gastos',
    ancora: 'NUMERO DA CONTA',
    exigidas: ['NUMERO DA CONTA', 'NOME DA CONTA CONTABIL', 'EMPRESA'],
    colEmpresa: 'EMPRESA',
    sinal: -1,
    monta: (t) => ({
      contaCodigo: t('NUMERO DA CONTA'),
      contaRotulo: t('NOME DA CONTA CONTABIL'),
      descricao: junta(t('DETALHAMENTO'), t('SUBPACOTE')),
      centroCusto: junta(t('CENTRO DE CUSTO'), t('NOME CENTRO DE CUSTO')),
      fornecedor: t('FORNECEDOR'),
      obs: [
        t('PACOTE') && `Pacote: ${t('PACOTE')}`,
        t('ALOCACAO PNL AREA') && `Área: ${t('ALOCACAO PNL AREA')}`,
        t('PRODUTO ANALITICO') && `Produto: ${t('PRODUTO ANALITICO')}`,
      ]
        .filter(Boolean)
        .join(' | '),
    }),
  },
  capex: {
    aba: 'Capex',
    ancora: 'NUMERO DA CONTA',
    exigidas: ['NUMERO DA CONTA', 'NOME DA CONTA CONTABIL', 'EMPRESA'],
    colEmpresa: 'EMPRESA',
    sinal: -1,
    monta: (t) => ({
      contaCodigo: t('NUMERO DA CONTA'),
      contaRotulo: t('NOME DA CONTA CONTABIL'),
      descricao: junta(t('ITEM'), t('DESCRICAO')),
      centroCusto: junta(t('CENTRO DE CUSTO'), t('NOME CENTRO DE CUSTO')),
      fornecedor: t('FORNECEDOR'),
      obs: [
        t('QUANT') && `Qtd: ${t('QUANT')}`,
        t('VALOR UNITARIO') && `Unitário: ${t('VALOR UNITARIO')}`,
        t('DETALHAMENTO'),
      ]
        .filter(Boolean)
        .join(' | '),
    }),
  },
}

/** Serial do Excel para o ano, para conferir contra o ciclo antes de importar. */
function anoDoSerial(serial) {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).getUTCFullYear()
}

export function lerPlanilha(arrayBuffer, tipo) {
  const cfg = TEMPLATE[tipo]
  if (!cfg) throw new Error(`Tipo "${tipo}" não tem aba mapeada no template.`)

  // `sheets` limita à aba pedida e `dense` guarda a aba como matriz em vez de um
  // objeto com uma chave por célula. São abas de milhares de linhas por ~100
  // colunas: sem isso o SheetJS cria milhões de propriedades para ler meia
  // dúzia de valores.
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', sheets: cfg.aba, dense: true })
  const aba = wb.Sheets[cfg.aba]
  if (!aba) {
    throw new Error(`A planilha não tem a aba "${cfg.aba}". Abas encontradas: ${wb.SheetNames.join(', ')}.`)
  }

  const r = XLSX.utils.decode_range(aba['!ref'])
  // No modo denso a aba vem em `!data`, indexada por [linha][coluna] com base
  // zero; `l` aqui é número de linha da planilha, base um.
  const denso = aba['!data']
  const bruto = denso
    ? (l, c) => denso[l - 1]?.[c]
    : (l, c) => aba[`${XLSX.utils.encode_col(c)}${l}`]
  const texto = (l, c) => {
    const x = bruto(l, c)
    return x?.v == null ? '' : String(x.v).split(/\s+/).filter(Boolean).join(' ')
  }
  const numero = (l, c) => {
    const x = bruto(l, c)
    return typeof x?.v === 'number' ? x.v : null
  }

  let cab = -1
  for (let l = r.s.r + 1; l <= r.e.r + 1 && cab === -1; l++) {
    for (let c = r.s.c; c <= r.e.c; c++) {
      if (lim(texto(l, c)) === cfg.ancora) {
        cab = l
        break
      }
    }
  }
  if (cab === -1) {
    throw new Error(`Não encontrei a linha de cabeçalho na aba "${cfg.aba}" (procurei a célula "${cfg.ancora}").`)
  }

  const col = {}
  for (let c = r.s.c; c <= r.e.c; c++) {
    const k = lim(texto(cab, c))
    if (k && col[k] === undefined) col[k] = c
  }
  const faltando = cfg.exigidas.filter((e) => col[e] === undefined)
  if (faltando.length) throw new Error(`Cabeçalho da aba "${cfg.aba}" sem as colunas: ${faltando.join(', ')}.`)

  // Primeiro bloco de 12 meses: a primeira sequência de 12 datas no cabeçalho.
  let datas = []
  for (let c = r.s.c; c <= r.e.c; c++) {
    const x = bruto(cab, c)
    const eData = typeof x?.v === 'number' && x.v > 40000 && x.v < 60000
    if (eData) datas.push(c)
    else if (datas.length >= 12) break
    else datas = []
  }
  if (datas.length < 12) throw new Error(`Achei ${datas.length} colunas de mês no cabeçalho da aba "${cfg.aba}"; esperava 12.`)
  const meses = datas.slice(0, 12)
  const ano = anoDoSerial(bruto(cab, meses[0]).v)

  const linhas = []
  for (let l = cab + 1; l <= r.e.r + 1; l++) {
    const empresa = texto(l, col[cfg.colEmpresa])
    // "x" e "xx" são as colunas/linhas separadoras do template, não dado
    if (lim(empresa) === 'X') continue

    const valores = meses.map((c, i) => ({ mes: i + 1, valor: (numero(l, c) ?? 0) * cfg.sinal }))
    if (!valores.some((v) => v.valor !== 0)) continue

    const t = (nome) => (col[nome] === undefined ? '' : texto(l, col[nome]))
    linhas.push({
      linha: l,
      empresa,
      ...cfg.monta(t),
      valores,
      total: valores.reduce((a, v) => a + v.valor, 0),
    })
  }
  return { tipo, aba: cfg.aba, ano, linhas }
}
