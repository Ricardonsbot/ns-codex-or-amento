/**
 * Carrega o mapa de centros de custo para a tabela `centro_de_custo` do Supabase,
 * lendo a aba "Mapa Centros de Custo" do Template Budget.
 *
 * Uso:
 *   cd app
 *   node --env-file=.env scripts/importar-centros-custo.mjs "<caminho do Template Budget .xlsb>"
 *   node --env-file=.env scripts/importar-centros-custo.mjs "<caminho>" --dry-run
 *
 * A coluna `area` é opcional. Se existir (criada por
 * app/supabase/migrations/2026-09-01-centro-de-custo-area.sql), a área vai nela.
 * Se não existir, vai embutida no nome como "ÁREA · Centro de Custo", para a
 * carga não depender de rodar DDL num banco compartilhado. Rodar de novo depois
 * de criar a coluna migra os registros para o formato limpo.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

const ABA = 'Mapa Centros de Custo'

// A aba é um mapa em cascata, não uma tabela: cada área ocupa uma coluna, e os
// centros de custo daquela área descem por ela. As três primeiras linhas úteis
// são BU, rótulo da área e chave da área (a chave é o nome do intervalo usado
// pelas fórmulas da planilha; o rótulo é o que se lê na tela).
const LINHA_BU = 2
const LINHA_ROTULO = 3
const LINHA_CHAVE = 4
const PRIMEIRA_LINHA_DE_CC = 5

function lerMapa(caminho) {
  const wb = XLSX.read(readFileSync(caminho), { type: 'buffer' })
  const aba = wb.Sheets[ABA]
  if (!aba) throw new Error(`aba "${ABA}" não encontrada — abas disponíveis: ${wb.SheetNames.join(', ')}`)

  // `range: 0` força a leitura a começar na primeira linha da planilha. Sem isso
  // o SheetJS começa na primeira linha não vazia, e os índices abaixo passam a
  // apontar para as linhas erradas.
  const matriz = XLSX.utils.sheet_to_json(aba, { header: 1, raw: true, defval: null, range: 0 })
  const texto = (linha, col) => {
    const v = matriz[linha]?.[col]
    return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim()
  }

  const largura = Math.max(...matriz.map((l) => l.length))

  // Se alguém inserir ou remover linhas no topo da aba, os índices acima passam
  // a ler o bloco errado. Os nomes de centro de custo têm todos a forma
  // "HOLDING - X" / "CSC - X" / "BU - X"; rótulo de área, não. Encontrar esse
  // padrão na linha de rótulo significa que escorregamos — melhor falhar aqui do
  // que importar os dados trocados.
  const pareceCentroDeCusto = (v) => / - /.test(v)
  const rotulos = Array.from({ length: largura }, (_, c) => texto(LINHA_ROTULO, c)).filter(Boolean)
  if (!rotulos.length) throw new Error(`linha ${LINHA_ROTULO + 1} (rótulos de área) está vazia — o layout da aba mudou?`)
  if (rotulos.some(pareceCentroDeCusto)) {
    throw new Error(
      `linha ${LINHA_ROTULO + 1} parece conter centros de custo, não áreas (${rotulos.find(pareceCentroDeCusto)}) — ` +
        'o layout da aba mudou; ajuste LINHA_BU/LINHA_ROTULO/LINHA_CHAVE.'
    )
  }

  const registros = []
  const areas = []

  for (let col = 0; col < largura; col++) {
    const rotulo = texto(LINHA_ROTULO, col)
    if (!rotulo) continue

    const bu = texto(LINHA_BU, col)
    const chave = texto(LINHA_CHAVE, col)
    const centros = []

    for (let linha = PRIMEIRA_LINHA_DE_CC; linha < matriz.length; linha++) {
      const nome = texto(linha, col)
      if (nome) centros.push(nome)
    }

    areas.push({ bu, rotulo, chave, centros })
    for (const nome of centros) {
      // O mapa não tem código numérico: o próprio nome do centro de custo é a
      // chave natural, e é ele que aparece nos lançamentos.
      registros.push({ codigo: nome, nome, area: rotulo })
    }
  }
  return { areas, registros }
}

// ---------------------------------------------------------------- main

const caminho = process.argv[2]
const simulacao = process.argv.includes('--dry-run')

if (!caminho) {
  console.error('uso: node --env-file=.env scripts/importar-centros-custo.mjs "<Template Budget .xlsb>" [--dry-run]')
  process.exit(1)
}

const { areas, registros } = lerMapa(caminho)

const duplicados = registros
  .map((r) => r.codigo)
  .filter((c, i, todos) => todos.indexOf(c) !== i)

console.log(`aba ................... ${ABA}`)
console.log(`BUs ................... ${[...new Set(areas.map((a) => a.bu))].join(', ')}`)
console.log(`áreas ................. ${areas.length}`)
console.log(`centros de custo ...... ${registros.length}`)
console.log('')
for (const a of areas) {
  console.log(`  ${a.rotulo.padEnd(22)} ${String(a.centros.length).padStart(2)} CC`)
}

if (duplicados.length) {
  console.log(`\nATENÇÃO — centro de custo repetido em mais de uma área: ${[...new Set(duplicados)].join(', ')}`)
  console.log('`codigo` é único na tabela, então só a última área venceria. Corrija a planilha antes.')
  process.exit(1)
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

// `codigo` continua sendo o nome limpo do centro de custo: e ele que aparece em
// `lancamento.centro_de_custo`, entao prefixar ali quebraria o vinculo. Quando
// nao ha coluna propria, a area vai para o nome — que, com a area na frente,
// ainda agrupa certo na ordenacao da tela.
const temColunaArea = !(await sb.from('centro_de_custo').select('area').limit(1)).error
const SEPARADOR = ' · '

const paraGravar = registros.map(({ codigo, nome, area }) =>
  temColunaArea ? { codigo, nome, area } : { codigo, nome: area ? `${area}${SEPARADOR}${nome}` : nome }
)

console.log(
  temColunaArea
    ? '\ncoluna `area` ......... existe, a área vai em coluna própria'
    : '\ncoluna `area` ......... não existe, a área vai embutida no nome ("ÁREA · Centro de Custo")'
)

const { error } = await sb.from('centro_de_custo').upsert(paraGravar, { onConflict: 'codigo' })
if (error) {
  console.error(`\nerro ao gravar: ${error.message}`)
  process.exit(1)
}

const { count } = await sb.from('centro_de_custo').select('*', { count: 'exact', head: true })
console.log(`\ngravados .............. ${registros.length}`)
console.log(`total na tabela ....... ${count}`)
