/**
 * Carrega os clientes para a tabela `cliente` do Supabase, a partir da saída do
 * processador de PDD ("<base> - por Cliente.xlsx", aba "Clientes").
 *
 * Uso:
 *   cd app
 *   node --env-file=.env scripts/importar-clientes.mjs "<caminho do ... - por Cliente.xlsx>"
 *   node --env-file=.env scripts/importar-clientes.mjs "<caminho>" --dry-run
 *   node --env-file=.env scripts/importar-clientes.mjs "<caminho>" --com-saldo
 *
 * Por padrão entram todos os clientes que aparecem na base. Com `--com-saldo`,
 * só os que têm saldo diferente de zero — a maioria zera no período, por ter
 * provisão e reversão no mesmo mês.
 *
 * A base de PDD não tem CNPJ nem contato, então só `nome` é preenchido.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

const ABA = 'Clientes'
const LOTE = 500

/** Mesma canonicalização do processar_pdd.py: sem acento, caixa alta, espaço
 *  colapsado. Serve só para deduplicar — o nome gravado é o original. */
function normalizar(valor) {
  return String(valor)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

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

  const linhas = XLSX.utils.sheet_to_json(aba, { defval: null })
  if (!linhas.length) throw new Error(`aba "${ABA}" está vazia`)
  if (!('Cliente' in linhas[0])) {
    throw new Error(`aba "${ABA}" não tem a coluna "Cliente" — colunas: ${Object.keys(linhas[0]).join(', ')}`)
  }

  return linhas
    .filter((l) => l.Cliente && String(l.Cliente).trim())
    .map((l) => ({
      nome: String(l.Cliente).trim(),
      saldo: Number(l.Saldo ?? 0),
      lancamentos: Number(l['Lançamentos'] ?? 0),
    }))
}

// ---------------------------------------------------------------- main

const caminho = process.argv[2]
const simulacao = process.argv.includes('--dry-run')
const soComSaldo = process.argv.includes('--com-saldo')

if (!caminho) {
  console.error('uso: node --env-file=.env scripts/importar-clientes.mjs "<... - por Cliente.xlsx>" [--dry-run] [--com-saldo]')
  process.exit(1)
}

const todos = ler(caminho)
const selecionados = soComSaldo ? todos.filter((c) => c.saldo !== 0) : todos

// A planilha já vem consolidada por cliente, mas dedupe de novo por segurança:
// a tabela `cliente` não tem restrição de unicidade em `nome`, então nada no
// banco impediria duplicatas.
const porChave = new Map()
for (const c of selecionados) {
  const chave = normalizar(c.nome)
  if (!porChave.has(chave)) porChave.set(chave, c.nome)
}
const nomes = [...porChave.values()]

console.log(`aba ................... ${ABA}`)
console.log(`clientes na planilha .. ${todos.length}`)
if (soComSaldo) console.log(`com saldo ≠ 0 ......... ${selecionados.length}`)
console.log(`após deduplicar ....... ${nomes.length}`)

if (simulacao) {
  console.log('\n--dry-run: nada foi gravado no Supabase.')
  process.exit(0)
}

const url = process.env.VITE_SUPABASE_URL
const chave = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !chave) {
  console.error('\nfaltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — rode com "node --env-file=.env".')
  process.exit(1)
}

const sb = createClient(url, chave)

// Sem unicidade em `nome` não há upsert possível: lê o que já existe e insere
// só o que falta, para reexecutar não duplicar.
const existentes = new Set()
for (let de = 0; ; de += 1000) {
  const { data, error } = await sb.from('cliente').select('nome').range(de, de + 999)
  if (error) {
    console.error(`\nerro ao ler clientes existentes: ${error.message}`)
    process.exit(1)
  }
  for (const c of data) existentes.add(normalizar(c.nome))
  if (data.length < 1000) break
}

const novos = nomes.filter((n) => !existentes.has(normalizar(n)))
console.log(`já no Supabase ........ ${existentes.size}`)
console.log(`a inserir ............. ${novos.length}`)

let inseridos = 0
for (let i = 0; i < novos.length; i += LOTE) {
  const lote = novos.slice(i, i + LOTE).map((nome) => ({ nome }))
  const { error } = await sb.from('cliente').insert(lote)
  if (error) {
    console.error(`\nerro no lote ${i}: ${error.message}`)
    process.exit(1)
  }
  inseridos += lote.length
  process.stdout.write(`\r  inseridos ${inseridos}/${novos.length}`)
}

const { count } = await sb.from('cliente').select('*', { count: 'exact', head: true })
console.log(`\n\ninseridos ............. ${inseridos}`)
console.log(`total na tabela ....... ${count}`)
console.log('\nA base de PDD não tem CNPJ nem contato — só `nome` foi preenchido.')
