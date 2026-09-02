/**
 * Carrega os produtos para a tabela `produto` do Supabase, lendo a planilha de
 * Net Revenue ("New_Net Revenue - Sync.xlsx").
 *
 * Uso:
 *   cd app
 *   node --env-file=.env scripts/importar-produtos.mjs "<caminho do New_Net Revenue - Sync.xlsx>"
 *   node --env-file=.env scripts/importar-produtos.mjs "<caminho>" --dry-run
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

// A lista limpa de produtos só existe nesta aba. As abas de Dashboard e de Input
// misturam produto com nível de agregação (Consolidado, Total PSL, Torre TMS,
// SW EMBARCADOR, Last Mile...) — importar de lá traria 17 linhas que não são
// produto.
const ABA_PRODUTOS = 'Dados Fechados'
const CABECALHO_PRODUTOS = 'Company/Product'

// A hierarquia vem daqui: os produtos aparecem na ordem da árvore, abaixo do
// grupo a que pertencem.
const ABA_HIERARQUIA = 'Input Projeções'

/** A planilha grafa o mesmo nome de formas diferentes entre abas ("LogRisk" e
 *  "Logrisk"). O casamento ignora caixa, acento e espaço repetido; a grafia que
 *  vale é a da aba de produtos. */
function normalizar(valor) {
  return String(valor)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

/**
 * Nada de índice fixo de linha ou coluna: o `!ref` desta planilha é "B1:CU96", e
 * o SheetJS indexa a partir do início do intervalo, não da coluna A. Ou seja, o
 * mesmo índice aponta para colunas diferentes conforme onde a aba começa —
 * silenciosamente. Por isso as colunas abaixo são localizadas pelo conteúdo.
 */
function matrizDe(wb, aba) {
  const planilha = wb.Sheets[aba]
  if (!planilha) throw new Error(`aba "${aba}" não encontrada — abas: ${wb.SheetNames.join(', ')}`)
  return XLSX.utils.sheet_to_json(planilha, { header: 1, raw: true, defval: null })
}

const texto = (v) => (v === null || v === undefined ? '' : String(v).trim())

/** Acha a célula do cabeçalho e devolve o que vem abaixo dela, na mesma coluna. */
function colunaAbaixoDe(matriz, cabecalho) {
  for (let linha = 0; linha < matriz.length; linha++) {
    const cols = matriz[linha] ?? []
    for (let col = 0; col < cols.length; col++) {
      if (texto(cols[col]) === cabecalho) {
        return matriz
          .slice(linha + 1)
          .map((l) => texto(l?.[col]))
          .filter(Boolean)
      }
    }
  }
  return null
}

/** Escolhe a coluna que mais casa com os nomes conhecidos. */
function colunaComMais(matriz, conhecidos) {
  const largura = Math.max(...matriz.map((l) => l?.length ?? 0))
  let melhor = { col: -1, acertos: 0 }
  for (let col = 0; col < largura; col++) {
    const acertos = matriz.filter((l) => conhecidos.has(normalizar(texto(l?.[col])))).length
    if (acertos > melhor.acertos) melhor = { col, acertos }
  }
  if (melhor.col === -1) return []
  return matriz.map((l) => texto(l?.[melhor.col])).filter(Boolean)
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

  const produtos = colunaAbaixoDe(matrizDe(wb, ABA_PRODUTOS), CABECALHO_PRODUTOS)
  if (!produtos) throw new Error(`não achei a célula "${CABECALHO_PRODUTOS}" na aba "${ABA_PRODUTOS}"`)

  const porNome = new Map(produtos.map((p) => [normalizar(p), p]))
  const grupoDe = new Map()
  const grafias = []

  let grupo = null
  for (const valor of colunaComMais(matrizDe(wb, ABA_HIERARQUIA), new Set(porNome.keys()))) {
    const chave = normalizar(valor)
    const produto = porNome.get(chave)
    if (produto) {
      grupoDe.set(produto, grupo)
      if (valor !== produto) grafias.push({ produtos: produto, hierarquia: valor })
    } else {
      grupo = valor // nó de agregação
    }
  }

  return { produtos, grupoDe, grafias }
}

// ---------------------------------------------------------------- main

const caminho = process.argv[2]
const simulacao = process.argv.includes('--dry-run')

if (!caminho) {
  console.error('uso: node --env-file=.env scripts/importar-produtos.mjs "<New_Net Revenue - Sync.xlsx>" [--dry-run]')
  process.exit(1)
}

const { produtos, grupoDe, grafias } = ler(caminho)

const semGrupo = produtos.filter((p) => !grupoDe.has(p))
const registros = produtos.map((p) => ({ codigo: p, nome: p, categoria: grupoDe.get(p) ?? null }))

const porGrupo = new Map()
for (const r of registros) porGrupo.set(r.categoria, (porGrupo.get(r.categoria) ?? 0) + 1)

console.log(`aba de produtos ....... ${ABA_PRODUTOS}`)
console.log(`aba de hierarquia ..... ${ABA_HIERARQUIA}`)
console.log(`produtos .............. ${produtos.length}`)
console.log('')
for (const [grupo, n] of [...porGrupo].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(grupo ?? '(sem grupo)').padEnd(28)} ${String(n).padStart(2)}`)
}

if (grafias.length) {
  console.log('\ngrafias divergentes entre as abas (vale a da aba de produtos):')
  for (const g of grafias) console.log(`  "${g.produtos}" / "${g.hierarquia}"`)
}

if (semGrupo.length) {
  console.log(`\nATENÇÃO — ${semGrupo.length} produto(s) sem grupo, entram com categoria vazia:`)
  for (const p of semGrupo) console.log(`  ${p}`)
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
const { error } = await sb.from('produto').upsert(registros, { onConflict: 'codigo' })
if (error) {
  console.error(`\nerro ao gravar: ${error.message}`)
  process.exit(1)
}

const { count } = await sb.from('produto').select('*', { count: 'exact', head: true })
console.log(`\ngravados .............. ${registros.length}`)
console.log(`total na tabela ....... ${count}`)
