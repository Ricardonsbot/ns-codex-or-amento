/**
 * Carrega as premissas macro (índices e câmbio projetados) para as tabelas
 * `indice` / `indice_valor_mensal` do Supabase, lendo a aba "Indices Reajuste"
 * do Template Budget.
 *
 * Uso:
 *   cd app
 *   node --env-file=.env scripts/importar-premissas-macro.mjs "<caminho do Template Budget .xlsb>"
 *   node --env-file=.env scripts/importar-premissas-macro.mjs "<caminho>" --dry-run
 *
 * Usa as tabelas que já existem, de propósito: assim a carga não depende de
 * rodar DDL no SQL Editor. O preço é `indice_valor_mensal.percentual` ser
 * `numeric(6,3)` — tudo fica com três casas decimais.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

const ABA = 'Indices Reajuste'

// Colunas da aba. O câmbio é nível em R$, não variação percentual; o sufixo no
// nome é o que a tela usa para saber que não deve compor o acumulado.
const INDICADORES = [
  { coluna: 'IGP-M', tipo: 'IGP-M', nivel: false },
  { coluna: 'IPCA', tipo: 'IPCA', nivel: false },
  { coluna: 'INPC', tipo: 'INPC', nivel: false },
  { coluna: 'Livre', tipo: 'Livre', nivel: false },
  { coluna: 'Dólar', tipo: 'Dólar (R$/US$)', nivel: true },
]

// Serial do Excel: dia 1 = 1899-12-31, com o bug do ano bissexto de 1900 embutido.
function dataDoSerial(n) {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000)
}

function lerAba(caminho) {
  const wb = XLSX.read(readFileSync(caminho), { type: 'buffer' })
  const aba = wb.Sheets[ABA]
  if (!aba) throw new Error(`aba "${ABA}" não encontrada — abas disponíveis: ${wb.SheetNames.join(', ')}`)

  // A tabela não começa em A1: acha a linha de cabeçalho pela célula "Mês".
  const matriz = XLSX.utils.sheet_to_json(aba, { header: 1, raw: true, defval: null })
  const iCabecalho = matriz.findIndex((l) => l.some((c) => typeof c === 'string' && c.trim() === 'Mês'))
  if (iCabecalho === -1) throw new Error('linha de cabeçalho (célula "Mês") não encontrada na aba')

  const cabecalho = matriz[iCabecalho].map((c) => (typeof c === 'string' ? c.trim() : c))
  const iMes = cabecalho.indexOf('Mês')

  const series = new Map() // "ano|tipo" -> { ano, tipo, nivel, meses: [{mes, valor}] }
  for (const linha of matriz.slice(iCabecalho + 1)) {
    const serial = linha[iMes]
    if (typeof serial !== 'number') continue // linha vazia ou de comentário
    const data = dataDoSerial(serial)

    for (const def of INDICADORES) {
      const iCol = cabecalho.indexOf(def.coluna)
      if (iCol === -1) throw new Error(`coluna "${def.coluna}" não encontrada na aba`)
      const bruto = linha[iCol]
      if (typeof bruto !== 'number') continue

      const chave = `${data.getUTCFullYear()}|${def.tipo}`
      if (!series.has(chave)) {
        series.set(chave, { ano: data.getUTCFullYear(), tipo: def.tipo, nivel: def.nivel, meses: [] })
      }
      series.get(chave).meses.push({
        mes: data.getUTCMonth() + 1,
        // A planilha guarda a variação como decimal (0.004342); o app trabalha
        // em pontos percentuais, então converte na entrada e não na exibição.
        valor: def.nivel ? bruto : bruto * 100,
      })
    }
  }
  return [...series.values()]
}

function acumulado(serie) {
  if (serie.nivel) return serie.meses[serie.meses.length - 1].valor
  return (serie.meses.reduce((acc, m) => acc * (1 + m.valor / 100), 1) - 1) * 100
}

/** Reaproveita o índice do mesmo tipo/ano se já existir, em vez de duplicar. */
async function garantirIndice(sb, serie) {
  const { data: existente, error } = await sb
    .from('indice')
    .select('id')
    .eq('tipo', serie.tipo)
    .eq('ano', serie.ano)
    .maybeSingle()
  if (error) throw new Error(`buscando índice ${serie.tipo}/${serie.ano}: ${error.message}`)
  if (existente) return { id: existente.id, criado: false }

  const { data, error: erroInsert } = await sb
    .from('indice')
    .insert({ tipo: serie.tipo, aplicacao: 'ambos', ano: serie.ano, status: 'ativo' })
    .select('id')
    .single()
  if (erroInsert) throw new Error(`criando índice ${serie.tipo}/${serie.ano}: ${erroInsert.message}`)
  return { id: data.id, criado: true }
}

// ---------------------------------------------------------------- main

const caminho = process.argv[2]
const simulacao = process.argv.includes('--dry-run')

if (!caminho) {
  console.error('uso: node --env-file=.env scripts/importar-premissas-macro.mjs "<Template Budget .xlsb>" [--dry-run]')
  process.exit(1)
}

const series = lerAba(caminho)
const anos = [...new Set(series.map((s) => s.ano))].sort()

console.log(`aba ................... ${ABA}`)
console.log(`anos .................. ${anos.join(', ')}`)
console.log(`séries ................ ${series.length}`)
for (const s of series) {
  const acum = acumulado(s)
  console.log(
    `  ${s.tipo.padEnd(16)} ${String(s.meses.length).padStart(2)} meses   ` +
      `acumulado ${acum.toFixed(4)}${s.nivel ? '' : '%'}`
  )
}

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
let criados = 0
let valores = 0

for (const serie of series) {
  const { id, criado } = await garantirIndice(sb, serie)
  if (criado) criados += 1

  const linhas = serie.meses.map((m) => ({ indice_id: id, mes: m.mes, percentual: m.valor }))
  const { error } = await sb.from('indice_valor_mensal').upsert(linhas, { onConflict: 'indice_id,mes' })
  if (error) {
    console.error(`erro gravando ${serie.tipo}/${serie.ano}: ${error.message}`)
    process.exit(1)
  }
  valores += linhas.length
}

const { count } = await sb.from('indice').select('*', { count: 'exact', head: true })
console.log(`\níndices criados ....... ${criados}`)
console.log(`valores mensais ....... ${valores}`)
console.log(`total na tabela indice  ${count}`)
console.log('\nAtenção: percentual é numeric(6,3) — os valores ficam com 3 casas decimais.')
