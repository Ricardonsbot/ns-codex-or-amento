import * as XLSX from 'xlsx'
import { lim } from './lerTemplateOrcamento'
import { ABAS_TARGET } from './formatosTemplate'

/**
 * Leitura do Template Pacoteiros: o teto do ano que o dono de cada pacote
 * combinou.
 *
 * É o menor dos quatro templates — uma linha por pacote — e por isso é lido na
 * própria thread, sem worker: não tem aba de milhares de linhas para travar a
 * tela.
 *
 * O valor pode vir de dois jeitos, e os dois valem: uma coluna de total do ano
 * ou doze colunas de mês, que são somadas. Quem abre o pacote por mês costuma
 * não preencher o total, e cobrar uma das duas formas só faria o arquivo voltar.
 */

const ROTULOS_VALOR = ['TARGET', 'VALOR', 'TOTAL ANO', 'TOTAL', 'TETO', 'ORCAMENTO', 'BUDGET']
const ROTULOS_RESP = ['RESPONSAVEL', 'PACOTEIRO', 'DONO', 'DONO DO PACOTE', 'GESTOR']
const ROTULOS_OBS = ['OBSERVACAO', 'OBSERVACOES', 'OBS', 'COMENTARIO']

const eSerial = (v) => typeof v === 'number' && v > 40000 && v < 60000
const anoDoSerial = (s) => new Date(Date.UTC(1899, 11, 30) + s * 86400000).getUTCFullYear()

/** Devolve `{ ano, linhas, ignoradas, aba }`. Lança se a aba não existir. */
export function lerTargetsPacote(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', dense: true })
  const nomeAba = wb.SheetNames.find((n) => ABAS_TARGET.includes(lim(n)))
  if (!nomeAba) {
    throw new Error(
      `A planilha não tem aba de target por pacote (procurei ${ABAS_TARGET.map((a) => `"${a}"`).join(', ')}). ` +
        `Abas encontradas: ${wb.SheetNames.join(', ')}.`
    )
  }

  const aba = wb.Sheets[nomeAba]
  const r = XLSX.utils.decode_range(aba['!ref'])
  const denso = aba['!data']
  const bruto = denso ? (l, c) => denso[l - 1]?.[c] : (l, c) => aba[`${XLSX.utils.encode_col(c)}${l}`]
  const texto = (l, c) => {
    const x = bruto(l, c)
    return x?.v == null ? '' : String(x.v).split(/\s+/).filter(Boolean).join(' ')
  }
  const numero = (l, c) => {
    const x = bruto(l, c)
    return typeof x?.v === 'number' ? x.v : null
  }

  let cab = -1
  for (let l = r.s.r + 1; l <= Math.min(r.e.r + 1, r.s.r + 40) && cab === -1; l++) {
    for (let c = r.s.c; c <= r.e.c; c++) {
      if (lim(texto(l, c)) === 'PACOTE') {
        cab = l
        break
      }
    }
  }
  if (cab === -1) throw new Error(`Não encontrei a coluna "Pacote" na aba "${nomeAba}".`)

  const col = {}
  const meses = []
  let ano = null
  for (let c = r.s.c; c <= r.e.c; c++) {
    const x = bruto(cab, c)
    if (eSerial(x?.v)) {
      meses.push(c)
      ano = ano ?? anoDoSerial(x.v)
      continue
    }
    const k = lim(texto(cab, c))
    if (k && col[k] === undefined) col[k] = c
    const doAno = /^ANO (\d{4})$/.exec(k)
    if (doAno) ano = ano ?? Number(doAno[1])
  }

  const achar = (rotulos) => {
    const k = rotulos.find((x) => col[x] !== undefined)
    return k === undefined ? null : col[k]
  }
  const cPacote = col.PACOTE
  const cValor = achar(ROTULOS_VALOR)
  const cResp = achar(ROTULOS_RESP)
  const cObs = achar(ROTULOS_OBS)
  if (cValor === null && meses.length !== 12) {
    throw new Error(
      `A aba "${nomeAba}" não tem coluna de valor do target (${ROTULOS_VALOR.join(', ')}) nem os doze meses do ano.`
    )
  }

  // Um pacote pode aparecer em mais de uma linha — aberto por mês, por
  // subpacote ou por empresa. O target é do pacote, então soma.
  const porPacote = new Map()
  let ignoradas = 0
  for (let l = cab + 1; l <= r.e.r + 1; l++) {
    const pacote = texto(l, cPacote).trim()
    if (!pacote) continue
    const valor =
      cValor !== null
        ? numero(l, cValor) ?? 0
        : meses.reduce((s, c) => s + (numero(l, c) ?? 0), 0)
    if (!valor) {
      // Pacote escrito e sem número: é linha esquecida, e some se não for dita.
      ignoradas += 1
      continue
    }
    const atual = porPacote.get(pacote)
    porPacote.set(pacote, {
      pacote,
      // O template escreve gasto como negativo; o target é um teto de gasto e
      // fica positivo, como o bottom up do quadro.
      valor: (atual?.valor ?? 0) + Math.abs(valor),
      responsavel: atual?.responsavel || (cResp === null ? '' : texto(l, cResp).trim()),
      observacao: atual?.observacao || (cObs === null ? '' : texto(l, cObs).trim()),
      linhas: (atual?.linhas ?? 0) + 1,
    })
  }

  return {
    aba: nomeAba,
    ano,
    ignoradas,
    linhas: [...porPacote.values()].sort((a, b) => a.pacote.localeCompare(b.pacote, 'pt-BR')),
  }
}
