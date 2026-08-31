/**
 * Importa o plano de contas do datalake de FP&A para a tabela `conta` do Supabase.
 *
 * Fonte de verdade: FPA_DW/Datalake_readFiles/tbl_KMM_Contas.xlsx (aba dContas).
 *
 * Uso:
 *   cd app
 *   node --env-file=.env scripts/importar-contas.mjs "<caminho do tbl_KMM_Contas.xlsx>"
 *   node --env-file=.env scripts/importar-contas.mjs "<caminho>" --dry-run
 *
 * O script lê VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY do .env (não commitado).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

// ---------------------------------------------------------------- regras

// Pacotes de balanço: não se orça sobre eles, ficam fora do cadastro.
const PACOTES_DE_BALANCO = new Set([
  'Ativo', 'Passivo', 'Adiantamentos', 'Caixa e equivalentes de caixa',
  'Contas a pagar em combinação de negócios', 'Despesas antecipadas',
  'Direito de Uso', 'Fornecedores', 'Imobilizado',
  'Imposto de Renda e Contribuição Social a pagar', 'Outros passivos',
  'Passivo de arrendamento', 'Salarios e encargos a pagar',
  'Tributos a pagar', 'Tributos a recuperar', 'Bônus a pagar', 'Intercompany',
])

const PACOTES_DE_RECEITA = new Set(['Gross Revenue', '(-) Deductions'])

// Reproduz a convenção de prefixo já usada no cadastro.
function linhaDoPL(pacote) {
  if (pacote === 'Capex') return 'Capex'
  if (PACOTES_DE_RECEITA.has(pacote)) return `Receita > ${pacote}`
  return `Despesas > ${pacote}`
}

const temPonto = (codigo) => codigo.includes('.')
const normalizar = (codigo) => codigo.replaceAll('.', '')

// O datalake grava a mesma descrição ora com acento, ora sem ("TRIBUTÁRIA" e
// "TRIBUTARIA"), então a comparação ignora acento, caixa e espaço repetido.
const normalizarNome = (nome) =>
  nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()

// ---------------------------------------------------------------- leitura

function lerPlanilha(caminho) {
  const wb = XLSX.read(readFileSync(caminho), { type: 'buffer' })
  const aba = wb.Sheets['dContas']
  if (!aba) throw new Error('aba "dContas" não encontrada na planilha')

  return XLSX.utils
    .sheet_to_json(aba)
    .filter((l) => !PACOTES_DE_BALANCO.has(l['FPA_Pacote']))
    .map((l) => ({
      codigo: String(l['ContaContabil']).trim(),
      nome: String(l['ContaContabil_Descricao']).trim(),
      linha_pl: linhaDoPL(l['FPA_Pacote']),
      categoria: String(l['FPA_Subpacote']).trim(),
    }))
}

/**
 * O datalake cadastra algumas contas duas vezes: uma com o código pontuado
 * (4.7.03.001.021) e outra sem ponto (4703001021). Quando as duas descrevem a
 * mesma conta, fica a pontuada. Quando as descrições divergem, são contas
 * diferentes com códigos conflitantes — mantém as duas e reporta, porque
 * decidir qual está errada exige quem conhece o plano de contas.
 */
function deduplicar(registros) {
  const porCodigoNormalizado = new Map()
  for (const r of registros) {
    const chave = normalizar(r.codigo)
    if (!porCodigoNormalizado.has(chave)) porCodigoNormalizado.set(chave, [])
    porCodigoNormalizado.get(chave).push(r)
  }

  const mantidos = []
  const descartados = []
  const ambiguos = []

  for (const grupo of porCodigoNormalizado.values()) {
    if (grupo.length === 1) {
      mantidos.push(grupo[0])
      continue
    }
    const nomesDistintos = new Set(grupo.map((r) => normalizarNome(r.nome)))
    if (nomesDistintos.size === 1) {
      const pontuado = grupo.find((r) => temPonto(r.codigo)) ?? grupo[0]
      mantidos.push(pontuado)
      descartados.push(...grupo.filter((r) => r !== pontuado))
    } else {
      ambiguos.push(grupo)
      mantidos.push(...grupo)
    }
  }
  return { mantidos, descartados, ambiguos }
}

// ---------------------------------------------------------------- carga

async function carregar(sb, registros) {
  // O lançamento aponta para conta com FK RESTRICT: as contas ainda
  // referenciadas são atualizadas no lugar, e só o resto é recriado.
  const { data: usados, error: erroUsados } = await sb
    .from('lancamento')
    .select('conta_id')
    .not('conta_id', 'is', null)
  if (erroUsados) throw new Error(`lendo lançamentos: ${erroUsados.message}`)

  const idsEmUso = [...new Set(usados.map((l) => l.conta_id))]
  const { data: contasEmUso } = idsEmUso.length
    ? await sb.from('conta').select('id, codigo').in('id', idsEmUso)
    : { data: [] }
  const codigoPorId = new Map(contasEmUso.map((c) => [c.codigo, c.id]))

  const apagar = sb.from('conta').delete()
  const { error: erroDelete } = idsEmUso.length
    ? await apagar.not('id', 'in', `(${idsEmUso.join(',')})`)
    : await apagar.neq('id', '00000000-0000-0000-0000-000000000000')
  if (erroDelete) throw new Error(`limpando conta: ${erroDelete.message}`)

  let inseridos = 0
  let atualizados = 0
  const novos = registros.filter((r) => !codigoPorId.has(r.codigo))

  for (let i = 0; i < novos.length; i += 100) {
    const lote = novos.slice(i, i + 100)
    const { error } = await sb.from('conta').insert(lote)
    if (error) throw new Error(`inserindo lote ${i}: ${error.message}`)
    inseridos += lote.length
  }

  for (const r of registros.filter((r) => codigoPorId.has(r.codigo))) {
    const { error } = await sb.from('conta').update(r).eq('id', codigoPorId.get(r.codigo))
    if (error) throw new Error(`atualizando ${r.codigo}: ${error.message}`)
    atualizados += 1
  }

  return { inseridos, atualizados }
}

// ---------------------------------------------------------------- main

const caminho = process.argv[2]
const simulacao = process.argv.includes('--dry-run')

if (!caminho) {
  console.error('uso: node --env-file=.env scripts/importar-contas.mjs "<tbl_KMM_Contas.xlsx>" [--dry-run]')
  process.exit(1)
}

const brutos = lerPlanilha(caminho)
const { mantidos, descartados, ambiguos } = deduplicar(brutos)

console.log(`planilha .............. ${brutos.length} contas de resultado/capex`)
console.log(`duplicatas removidas .. ${descartados.length} (código sem ponto, descrição idêntica)`)
console.log(`a carregar ............ ${mantidos.length}`)

if (descartados.length) {
  console.log('\ndescartadas:')
  for (const r of descartados) console.log(`  ${r.codigo.padEnd(20)} ${r.nome}`)
}

if (ambiguos.length) {
  console.log('\nATENÇÃO — mesmo código normalizado, descrições diferentes (as duas foram mantidas):')
  for (const grupo of ambiguos) {
    for (const r of grupo) console.log(`  ${r.codigo.padEnd(20)} ${r.nome}`)
    console.log('')
  }
}

if (simulacao) {
  console.log('--dry-run: nada foi gravado no Supabase.')
  process.exit(0)
}

const url = process.env.VITE_SUPABASE_URL
const chave = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !chave) {
  console.error('\nfaltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — rode com "node --env-file=.env".')
  process.exit(1)
}

const sb = createClient(url, chave)
const { inseridos, atualizados } = await carregar(sb, mantidos)
const { count } = await sb.from('conta').select('*', { count: 'exact', head: true })

console.log(`\ninseridos ............. ${inseridos}`)
console.log(`atualizados no lugar .. ${atualizados}`)
console.log(`total na tabela conta . ${count}`)
