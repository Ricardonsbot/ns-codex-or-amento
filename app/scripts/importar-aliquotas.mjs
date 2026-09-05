/**
 * Gera src/data/aliquotas.json a partir da aba "Mapa Aliquotas" do Template
 * Budget: alíquota efetiva por Empresa × Produto Sintético.
 *
 * Uso:
 *   cd app
 *   node scripts/importar-aliquotas.mjs "<Template Budget .xlsb>" [--dry-run]
 *
 * Como o mapa de alçadas, não grava no Supabase: são oito campos por linha e
 * nenhuma tabela existente comporta isso. Os dados ficam versionados.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const ABA = 'Mapa Aliquotas'

// Endereçamento por letra para as dimensões: abas desta pasta começam fora da
// coluna A. As colunas de tributo são localizadas pelo TEXTO do cabeçalho, e
// não por letra, porque elas já andaram uma vez: o mapa tinha "Consolidado" em
// N e "Total" em O, deixou de ter consolidado e o Total assumiu o N. Por letra,
// isso teria lido a alíquota errada em silêncio.
const COL = { chave: 'B', bu: 'C', torre: 'D', subtorre: 'E', empresa: 'F', produto: 'G' }
const TRIBUTOS = ['ISS', 'PIS', 'COFINS', 'ICMS', 'CPRB', 'IVA']

const SAIDA = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'aliquotas.json')

function ler(caminho) {
  let buffer
  try {
    buffer = readFileSync(caminho)
  } catch (err) {
    if (err.code === 'EBUSY' || err.code === 'EPERM') {
      throw new Error(`não consegui ler "${caminho}" — o arquivo está aberto no Excel? Feche e rode de novo.`)
    }
    throw err
  }

  const wb = XLSX.read(buffer, { type: 'buffer' })
  const aba = wb.Sheets[ABA]
  if (!aba) throw new Error(`aba "${ABA}" não encontrada — abas: ${wb.SheetNames.join(', ')}`)

  const intervalo = XLSX.utils.decode_range(aba['!ref'])
  const texto = (l, c) => {
    const x = aba[`${c}${l}`]
    return x?.v == null ? '' : String(x.v).split(/\s+/).filter(Boolean).join(' ')
  }
  const numero = (l, c) => {
    const x = aba[`${c}${l}`]
    return typeof x?.v === 'number' ? x.v : null
  }

  const cab = (() => {
    for (let l = intervalo.s.r + 1; l <= intervalo.e.r + 1; l++) {
      if (texto(l, COL.chave) === 'chave') return l
    }
    throw new Error(`não achei o cabeçalho (célula "chave" na coluna ${COL.chave})`)
  })()

  // Mapeia cada tributo (e o Total) para a coluna onde o cabeçalho o nomeia.
  const porRotulo = {}
  for (let c = intervalo.s.c; c <= intervalo.e.c; c++) {
    const letra = XLSX.utils.encode_col(c)
    const k = texto(cab, letra).toUpperCase()
    if (k && porRotulo[k] === undefined) porRotulo[k] = letra
  }
  const exigidas = [...TRIBUTOS, 'TOTAL']
  const faltando = exigidas.filter((e) => porRotulo[e] === undefined)
  if (faltando.length) {
    throw new Error(`cabeçalho da aba "${ABA}" sem as colunas: ${faltando.join(', ')} — o layout mudou?`)
  }

  const registros = []
  for (let l = cab + 1; l <= intervalo.e.r + 1; l++) {
    // Depois dos dados a aba tem ~30 linhas só com Total=0, resto de fórmula.
    // A chave é o que separa linha real de sobra.
    if (!texto(l, COL.chave)) continue
    const tributos = {}
    for (const t of TRIBUTOS) tributos[t.toLowerCase()] = numero(l, porRotulo[t])
    registros.push({
      bu: texto(l, COL.bu),
      torre: texto(l, COL.torre),
      subtorre: texto(l, COL.subtorre),
      empresa: texto(l, COL.empresa),
      produto: texto(l, COL.produto),
      ...tributos,
      total: numero(l, porRotulo.TOTAL),
    })
  }
  return registros
}

// ---------------------------------------------------------------- main

const caminho = process.argv[2]
const simulacao = process.argv.includes('--dry-run')

if (!caminho) {
  console.error('uso: node scripts/importar-aliquotas.mjs "<Template Budget .xlsb>" [--dry-run]')
  process.exit(1)
}

const registros = ler(caminho)
if (!registros.length) throw new Error(`nenhuma linha com chave na aba "${ABA}" — o layout mudou?`)

const temTributo = (r) => ['iss', 'pis', 'cofins', 'icms', 'cprb', 'iva'].some((t) => r[t] !== null)
const abertas = registros.filter(temTributo)

console.log(`aba ................... ${ABA}`)
console.log(`linhas ................ ${registros.length}`)
console.log(`  abertas por tributo . ${abertas.length}`)
console.log(`  sem nenhum tributo .. ${registros.length - abertas.length}`)
console.log(`empresas .............. ${new Set(registros.map((r) => r.empresa)).size}`)
console.log(`produtos .............. ${new Set(registros.map((r) => r.produto)).size}`)

const porBU = new Map()
for (const r of registros) porBU.set(r.bu, (porBU.get(r.bu) ?? 0) + 1)
console.log('')
for (const [bu, n] of porBU) console.log(`  ${String(bu).padEnd(16)} ${String(n).padStart(2)}`)

const comTotal = registros.filter((r) => r.total !== null)
if (comTotal.length) {
  const tx = comTotal.map((r) => r.total)
  console.log(`\nalíquota total: de ${(Math.min(...tx) * 100).toFixed(2)}% a ${(Math.max(...tx) * 100).toFixed(2)}%`)
}

if (simulacao) {
  console.log('\n--dry-run: nada foi gravado.')
  process.exit(0)
}

mkdirSync(dirname(SAIDA), { recursive: true })
writeFileSync(SAIDA, JSON.stringify({ origem: 'Template Budget', aba: ABA, registros }, null, 2) + '\n', 'utf8')
console.log(`\ngravado ............... ${SAIDA}`)
