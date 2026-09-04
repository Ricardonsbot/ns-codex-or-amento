/**
 * Carrega os produtos a partir do "Mapa Produtos_NOVO" do Template Budget,
 * substituindo a carga antiga que vinha do Net Revenue.
 *
 * Uso:
 *   cd app
 *   node --env-file=.env scripts/importar-produtos-mapa.mjs "<Template Budget .xlsb>" --dry-run
 *   node --env-file=.env scripts/importar-produtos-mapa.mjs "<Template Budget .xlsb>" --sincronizar
 *
 * Por que substitui: a carga anterior saiu do "New_Net Revenue - Sync", que
 * mistura empresa com produto (BRK, Comprovei, Opentech e Onisys são empresas).
 * O mapa novo tem taxonomia de produto de verdade, em dois níveis.
 *
 * `codigo` e `nome` recebem o Produto Analítico, que é a folha; `categoria`
 * recebe o Produto Sintético, que é o agrupamento acima dele.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

const ABA = 'Mapa Produtos_NOVO'
const LOTE = 500

// Endereçamento por letra de coluna: esta pasta tem abas que começam fora da
// coluna A, e o sheet_to_json indexa a partir do início do intervalo. Índice de
// array escorrega sem dar erro.
//
// A aba tem DOIS blocos independentes lado a lado. B–F é a hierarquia de
// produto; K–M é uma lista empresa × produto de escopo menor, que não entra
// aqui — as linhas dos dois blocos não se correspondem.
const COL = { bu: 'B', torre: 'C', subtorre: 'D', sintetico: 'E', analitico: 'F' }

const normalizar = (v) =>
  String(v).normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().split(/\s+/).filter(Boolean).join(' ')

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
  const cel = (l, c) => {
    const x = aba[`${c}${l}`]
    return x?.v == null ? '' : String(x.v).split(/\s+/).filter(Boolean).join(' ')
  }

  const linhaCabecalho = (() => {
    for (let l = intervalo.s.r + 1; l <= intervalo.e.r + 1; l++) {
      if (cel(l, COL.bu) === 'BU') return l
    }
    throw new Error(`não achei o cabeçalho (célula "BU" na coluna ${COL.bu})`)
  })()

  const registros = []
  for (let l = linhaCabecalho + 1; l <= intervalo.e.r + 1; l++) {
    const bu = cel(l, COL.bu)
    const analitico = cel(l, COL.analitico)
    if (!bu || !analitico) continue
    registros.push({
      bu,
      torre: cel(l, COL.torre),
      subtorre: cel(l, COL.subtorre),
      sintetico: cel(l, COL.sintetico),
      analitico,
    })
  }
  return registros
}

// ---------------------------------------------------------------- main

const caminho = process.argv[2]
const simulacao = process.argv.includes('--dry-run')
const sincronizar = process.argv.includes('--sincronizar')

if (!caminho) {
  console.error('uso: node --env-file=.env scripts/importar-produtos-mapa.mjs "<Template Budget .xlsb>" [--dry-run] [--sincronizar]')
  process.exit(1)
}

const linhas = ler(caminho)

// Um produto analítico pode aparecer em várias linhas (uma por empresa/torre).
// Fica a primeira ocorrência; se o sintético divergir entre linhas, avisa.
const porProduto = new Map()
const conflitos = []
for (const l of linhas) {
  const chave = normalizar(l.analitico)
  if (!porProduto.has(chave)) {
    porProduto.set(chave, { codigo: l.analitico, nome: l.analitico, categoria: l.sintetico || null })
  } else if (normalizar(porProduto.get(chave).categoria ?? '') !== normalizar(l.sintetico)) {
    conflitos.push({ produto: l.analitico, a: porProduto.get(chave).categoria, b: l.sintetico })
  }
}
const registros = [...porProduto.values()]

console.log(`aba ................... ${ABA}`)
console.log(`linhas do bloco A ..... ${linhas.length}`)
console.log(`produtos analíticos ... ${registros.length}`)
console.log(`produtos sintéticos ... ${new Set(linhas.map((l) => normalizar(l.sintetico))).size}`)

if (conflitos.length) {
  console.log(`\nATENÇÃO — ${conflitos.length} produto(s) com sintético divergente entre linhas (fica o primeiro):`)
  for (const c of conflitos.slice(0, 10)) console.log(`  ${c.produto}: "${c.a}" vs "${c.b}"`)
}

const url = process.env.VITE_SUPABASE_URL
const chave = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !chave) {
  console.error('\nfaltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — rode com "node --env-file=.env".')
  process.exit(1)
}

const sb = createClient(url, chave)
const { data: atuais, error } = await sb.from('produto').select('id, codigo')
if (error) {
  console.error(`\nerro ao ler produtos: ${error.message}`)
  process.exit(1)
}

const doMapa = new Set(registros.map((r) => normalizar(r.codigo)))
const existentes = new Map(atuais.map((p) => [normalizar(p.codigo), p]))
const novos = registros.filter((r) => !existentes.has(normalizar(r.codigo)))
const sobrando = atuais.filter((p) => !doMapa.has(normalizar(p.codigo)))

console.log(`\njá no Supabase ........ ${atuais.length}`)
console.log(`a inserir ............. ${novos.length}`)
console.log(`fora do mapa .......... ${sobrando.length}${sincronizar ? ' (serão APAGADOS)' : ' (mantidos — use --sincronizar)'}`)
if (sincronizar && sobrando.length) {
  for (const p of sobrando) console.log(`    ${p.codigo}`)
}

if (simulacao) {
  console.log('\n--dry-run: nada foi gravado no Supabase.')
  process.exit(0)
}

let inseridos = 0
for (let i = 0; i < novos.length; i += LOTE) {
  const lote = novos.slice(i, i + LOTE)
  const { error: e } = await sb.from('produto').insert(lote)
  if (e) {
    console.error(`\nerro no lote ${i}: ${e.message}`)
    process.exit(1)
  }
  inseridos += lote.length
}

let apagados = 0
if (sincronizar && sobrando.length) {
  for (let i = 0; i < sobrando.length; i += LOTE) {
    const ids = sobrando.slice(i, i + LOTE).map((p) => p.id)
    const { error: e } = await sb.from('produto').delete().in('id', ids)
    if (e) {
      console.error(`\nerro ao apagar lote ${i}: ${e.message}`)
      process.exit(1)
    }
    apagados += ids.length
  }
}

const { count } = await sb.from('produto').select('*', { count: 'exact', head: true })
console.log(`\ninseridos ............. ${inseridos}`)
if (sincronizar) console.log(`apagados .............. ${apagados}`)
console.log(`total na tabela ....... ${count}`)
console.log(`esperado (mapa) ....... ${registros.length}`)
