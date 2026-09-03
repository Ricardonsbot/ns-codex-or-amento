/**
 * Gera src/data/alcadas-aprovacao.json a partir da planilha
 * "Quem faz x Quem Valida.xlsx" (aba "Painel Responsáveis").
 *
 * Uso:
 *   cd app
 *   node scripts/importar-alcadas.mjs "<caminho do Quem faz x Quem Valida.xlsx>"
 *   node scripts/importar-alcadas.mjs "<caminho>" --dry-run
 *
 * Diferente dos outros importadores, este não grava no Supabase: a matriz tem
 * seis campos por bloco e nenhuma tabela existente comporta isso, então os
 * dados ficam versionados no repositório. Quando a tela precisar ser editável,
 * o caminho é criar a tabela e trocar a leitura do JSON por uma consulta.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const ABA = 'Painel Responsáveis'

// Endereçamento por letra de coluna, direto na célula. Não use índices de
// array aqui: o `!ref` desta aba é "C3:N113" e o sheet_to_json indexa a partir
// do início do intervalo, não da coluna A — os índices escorregam duas colunas
// sem dar erro nenhum.
const COL = {
  grupo: 'C',
  pacote: 'D',
  item: 'E',
  bu: { faz: 'G', valida1: 'H', valida2: 'I' },
  comentario: 'J',
  corporate: { faz: 'L', valida1: 'M', valida2: 'N' },
}

const SAIDA = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'alcadas-aprovacao.json')

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
  const cel = (linha, coluna) => {
    const c = aba[`${coluna}${linha}`]
    if (!c || c.v === null || c.v === undefined) return ''
    return String(c.v).split(/\s+/).filter(Boolean).join(' ')
  }
  const trio = (linha, cols) => {
    const faz = cel(linha, cols.faz)
    const valida1 = cel(linha, cols.valida1)
    const valida2 = cel(linha, cols.valida2)
    return faz || valida1 || valida2 ? { faz, valida1, valida2: valida2 || null } : null
  }

  // O cabeçalho fica na linha 4; as linhas de dados começam depois dela.
  const linhaCabecalho = (() => {
    for (let l = intervalo.s.r + 1; l <= intervalo.e.r + 1; l++) {
      if (cel(l, COL.bu.faz).toLowerCase() === 'quem faz') return l
    }
    throw new Error(`não achei a linha de cabeçalho (célula "Quem faz" na coluna ${COL.bu.faz})`)
  })()

  const registros = []
  let grupo = ''
  let pacote = ''

  for (let l = linhaCabecalho + 1; l <= intervalo.e.r + 1; l++) {
    const g = cel(l, COL.grupo)
    const p = cel(l, COL.pacote)
    const item = cel(l, COL.item)

    if (g) {
      grupo = g
      pacote = '' // grupo novo zera o pacote herdado
    }
    if (p) pacote = p

    const bu = trio(l, COL.bu)
    const corporate = trio(l, COL.corporate)
    if (!bu && !corporate) continue

    // A responsabilidade aparece em três níveis: na linha do item, na do
    // pacote (a maioria dos grupos não desce até item) ou na do próprio grupo.
    const nivel = item ? 'item' : p ? 'pacote' : 'grupo'
    registros.push({
      grupo,
      pacote: pacote || null,
      item: item || null,
      nivel,
      titulo: item || pacote || grupo,
      bu,
      corporate,
      comentario: cel(l, COL.comentario) || null,
      linha: l,
    })
  }
  return registros
}

// ---------------------------------------------------------------- main

const caminho = process.argv[2]
const simulacao = process.argv.includes('--dry-run')

if (!caminho) {
  console.error('uso: node scripts/importar-alcadas.mjs "<Quem faz x Quem Valida.xlsx>" [--dry-run]')
  process.exit(1)
}

const registros = ler(caminho)
if (!registros.length) throw new Error(`nenhuma responsabilidade encontrada na aba "${ABA}" — o layout mudou?`)

const grupos = [...new Set(registros.map((r) => r.grupo))]
const porNivel = registros.reduce((acc, r) => ({ ...acc, [r.nivel]: (acc[r.nivel] ?? 0) + 1 }), {})

console.log(`aba ................... ${ABA}`)
console.log(`grupos ................ ${grupos.length}`)
console.log(`responsabilidades ..... ${registros.length}`)
console.log(`  no item ............. ${porNivel.item ?? 0}`)
console.log(`  no pacote ........... ${porNivel.pacote ?? 0}`)
console.log(`  no grupo ............ ${porNivel.grupo ?? 0}`)
console.log(`com bloco BU .......... ${registros.filter((r) => r.bu).length}`)
console.log(`com bloco Corporate ... ${registros.filter((r) => r.corporate).length}`)
console.log(`com comentário ........ ${registros.filter((r) => r.comentario).length}`)
console.log('')
for (const g of grupos) {
  const n = registros.filter((r) => r.grupo === g).length
  console.log(`  ${g.slice(0, 44).padEnd(46)} ${String(n).padStart(2)}`)
}

if (simulacao) {
  console.log('\n--dry-run: nada foi gravado.')
  process.exit(0)
}

mkdirSync(dirname(SAIDA), { recursive: true })
writeFileSync(
  SAIDA,
  JSON.stringify({ origem: 'Quem faz x Quem Valida.xlsx', aba: ABA, grupos, registros }, null, 2) + '\n',
  'utf8'
)
console.log(`\ngravado ............... ${SAIDA}`)
