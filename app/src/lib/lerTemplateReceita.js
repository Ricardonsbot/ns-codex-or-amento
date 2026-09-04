import * as XLSX from 'xlsx'

/**
 * Leitura da aba "Receita" do Template Budget, para importação pela tela.
 *
 * A aba tem 22 colunas de dimensão e CINCO blocos de 12 meses encadeados:
 * bruta digitada → proporção → após reajuste → deduções → líquida. Entra a
 * BRUTA: a ferramenta já guarda as alíquotas e o P&L trata dedução como linha
 * própria, então gravar a líquida perderia a dedução pelo caminho.
 *
 * Colunas são localizadas pelo texto do cabeçalho, nunca por índice: as abas
 * desta pasta começam fora da coluna A, e o SheetJS indexa a partir do início
 * do intervalo — índice fixo aponta para a coluna errada sem dar erro.
 */

export const ABA = 'Receita'

const semAcento = (v) => String(v).normalize('NFD').replace(/\p{Diacritic}/gu, '')
export const lim = (v) => semAcento(v).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

/** Colunas de dimensão que a aba precisa ter para ser reconhecida. */
const EXIGIDAS = ['TIPO RECEITA', 'CONTA CONTABIL', 'EMPRESA', 'PRODUTO ANALITICO']

export function lerPlanilha(arrayBuffer) {
  // `sheets` limita à aba de Receita e `dense` guarda a aba como matriz em vez
  // de um objeto com uma chave por célula. A aba tem 18 mil linhas por 101
  // colunas: sem isso o SheetJS cria ~1,8 milhão de propriedades para ler
  // meia dúzia de valores.
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', sheets: ABA, dense: true })
  const aba = wb.Sheets[ABA]
  if (!aba) {
    throw new Error(`A planilha não tem a aba "${ABA}". Abas encontradas: ${wb.SheetNames.join(', ')}.`)
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
      if (lim(texto(l, c)) === 'TIPO RECEITA') {
        cab = l
        break
      }
    }
  }
  if (cab === -1) throw new Error('Não encontrei a linha de cabeçalho (célula "Tipo Receita") na aba Receita.')

  const col = {}
  for (let c = r.s.c; c <= r.e.c; c++) {
    const k = lim(texto(cab, c))
    if (k && col[k] === undefined) col[k] = c
  }
  const faltando = EXIGIDAS.filter((e) => col[e] === undefined)
  if (faltando.length) throw new Error(`Cabeçalho sem as colunas: ${faltando.join(', ')}.`)

  // Os 12 meses da receita bruta: primeira sequência de 12 datas no cabeçalho.
  let datas = []
  for (let c = r.s.c; c <= r.e.c; c++) {
    const x = bruto(cab, c)
    const eData = typeof x?.v === 'number' && x.v > 40000 && x.v < 60000
    if (eData) datas.push(c)
    else if (datas.length >= 12) break
    else datas = []
  }
  if (datas.length < 12) throw new Error(`Achei ${datas.length} colunas de mês no cabeçalho; esperava 12.`)
  const meses = datas.slice(0, 12)

  const linhas = []
  for (let l = cab + 1; l <= r.e.r + 1; l++) {
    const empresa = texto(l, col.EMPRESA)
    const tipoReceita = texto(l, col['TIPO RECEITA'])
    // "x" é a linha separadora do template, não um dado
    if (!empresa || lim(empresa) === 'X' || lim(tipoReceita) === 'X') continue

    const valores = meses.map((c, i) => ({ mes: i + 1, valor: numero(l, c) ?? 0 }))
    if (!valores.some((v) => v.valor !== 0)) continue

    linhas.push({
      linha: l,
      tipoReceita,
      contaRotulo: texto(l, col['CONTA CONTABIL']),
      empresa,
      produtoSintetico: col['PRODUTO SINTETICO'] === undefined ? '' : texto(l, col['PRODUTO SINTETICO']),
      produtoAnalitico: texto(l, col['PRODUTO ANALITICO']),
      cliente: col['RAZAO SOCIAL CLIENTE'] === undefined ? '' : texto(l, col['RAZAO SOCIAL CLIENTE']),
      obs: col.OBS === undefined ? '' : texto(l, col.OBS),
      valores,
      total: valores.reduce((a, v) => a + v.valor, 0),
    })
  }
  return linhas
}

