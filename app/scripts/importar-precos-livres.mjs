/**
 * Carrega a série mensal de PREÇOS LIVRES (índice "Livre") a partir do relatório
 * do Itaú BBA, direto na fonte primária.
 *
 * Uso:
 *   cd app
 *   node --env-file=.env scripts/importar-precos-livres.mjs "<brazil_short_term_forecasts.xlsx>" [--dry-run]
 *
 * Por que não sai do Template Budget, como as outras quatro séries:
 *
 *   - No Template Budget "Torres 2027 - v0_1" a coluna Livre era 1,07% em todos
 *     os meses, com a anotação "coloquei como juros livres" ao lado. Era um
 *     valor de espera, não uma projeção — e foi assim que entrou no Supabase.
 *   - No "Receita 2027 - v0" a coluna passou a trazer a série real, mas como
 *     acumulado de 12 meses (%YoY), que não serve para uma tabela que guarda
 *     variação mensal e não dá para converter de volta sem o ano anterior.
 *
 * Os %YoY daquele template batem, nos 12 meses, com "Market-Set Prices" da aba
 * "Brazil - Inflation" deste relatório. Ou seja: preços livres, e não juros.
 * Este script lê a coluna %MoM da mesma série, que é o que a tabela precisa.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

const ABA = 'Brazil - Inflation'
const SERIE = 'Market-Set Prices'
const TIPO = 'Livre'

/** Serial do Excel: dia 1 = 1899-12-31, com o bug do ano bissexto de 1900. */
function dataDoSerial(n) {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000)
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

  const matriz = XLSX.utils.sheet_to_json(aba, { header: 1, raw: true, defval: null })

  // O cabeçalho é de dois andares: uma linha nomeia a série e, na linha de
  // baixo, cada série se abre em %MoM e %YoY. A coluna certa é a %MoM logo à
  // direita do rótulo da série — por isso as duas linhas são localizadas por
  // conteúdo, e não por posição.
  const iSerie = matriz.findIndex((l) => l.some((c) => typeof c === 'string' && c.trim() === SERIE))
  if (iSerie === -1) throw new Error(`não achei a série "${SERIE}" na aba "${ABA}"`)
  const cSerie = matriz[iSerie].findIndex((c) => typeof c === 'string' && c.trim() === SERIE)

  const medidas = matriz[iSerie + 1] ?? []
  const cMoM = [cSerie, cSerie + 1].find((c) => String(medidas[c] ?? '').trim() === '%MoM')
  if (cMoM === undefined) {
    throw new Error(`a coluna %MoM de "${SERIE}" não está onde deveria — o layout do relatório mudou?`)
  }

  const meses = []
  for (const linha of matriz.slice(iSerie + 2)) {
    const serial = linha[0]
    if (typeof serial !== 'number') continue
    const valor = linha[cMoM]
    if (typeof valor !== 'number') continue
    const data = dataDoSerial(serial)
    // O relatório guarda a variação como decimal (0.00506); a tabela deste
    // projeto trabalha em pontos percentuais.
    meses.push({ ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1, valor: valor * 100 })
  }
  return meses
}

// ---------------------------------------------------------------- main

const caminho = process.argv[2]
const simulacao = process.argv.includes('--dry-run')

if (!caminho) {
  console.error('uso: node --env-file=.env scripts/importar-precos-livres.mjs "<brazil_short_term_forecasts.xlsx>" [--dry-run]')
  process.exit(1)
}

const url = process.env.VITE_SUPABASE_URL
const chave = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !chave) {
  console.error('faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — rode com "node --env-file=.env".')
  process.exit(1)
}

const todos = ler(caminho)
const sb = createClient(url, chave)

// Só os anos que já existem como índice: este script corrige uma série que a
// carga de premissas criou, não cria ano novo.
const { data: indices, error } = await sb.from('indice').select('id, ano').eq('tipo', TIPO)
if (error) {
  console.error(`erro ao ler os índices "${TIPO}": ${error.message}`)
  process.exitCode = 1
} else if (!indices.length) {
  console.error(`nenhum índice "${TIPO}" cadastrado — rode antes o importar-premissas-macro.mjs.`)
  process.exitCode = 1
} else {
  console.log(`série ................. ${SERIE} (%MoM)`)
  console.log(`meses no relatório .... ${todos.length}`)

  for (const indice of indices) {
    const meses = todos.filter((m) => m.ano === indice.ano).sort((a, b) => a.mes - b.mes)
    if (meses.length !== 12) {
      console.log(`\n${indice.ano}: o relatório tem ${meses.length} meses, esperava 12 — pulando.`)
      process.exitCode = 1
      continue
    }

    const { data: antes } = await sb
      .from('indice_valor_mensal')
      .select('mes, percentual')
      .eq('indice_id', indice.id)
      .order('mes')

    const comp = (v) => (v.reduce((a, x) => a * (1 + x / 100), 1) - 1) * 100
    const de = (antes ?? []).map((v) => Number(v.percentual))
    const para = meses.map((m) => m.valor)
    console.log(`\n${indice.ano}`)
    console.log(`   de ..... ${de.map((v) => v.toFixed(2)).join(' ')}   (composto ${comp(de).toFixed(2)}%)`)
    console.log(`   para ... ${para.map((v) => v.toFixed(2)).join(' ')}   (composto ${comp(para).toFixed(2)}%)`)

    if (simulacao) continue
    const linhas = meses.map((m) => ({ indice_id: indice.id, mes: m.mes, percentual: m.valor }))
    const { error: e } = await sb.from('indice_valor_mensal').upsert(linhas, { onConflict: 'indice_id,mes' })
    if (e) {
      console.error(`   erro ao gravar: ${e.message}`)
      process.exitCode = 1
    } else {
      console.log('   gravado.')
    }
  }

  if (simulacao) console.log('\n--dry-run: nada foi gravado.')
}
