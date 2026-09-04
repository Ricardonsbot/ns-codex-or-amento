/**
 * Importa a aba "Receita" do Template Budget para o módulo de Receita
 * (lancamento com tipo='receita' + lancamento_valor_mensal).
 *
 * Uso:
 *   cd app
 *   node --env-file=.env scripts/importar-receita.mjs "<Template Budget .xlsb>"
 *   node --env-file=.env scripts/importar-receita.mjs "<Template Budget .xlsb>" --aplicar
 *
 * Sem --aplicar só planeja e imprime.
 *
 * A aba tem 22 colunas de dimensão e CINCO blocos de 12 meses encadeados:
 * bruta digitada → proporção → após reajuste → deduções → líquida. Entra a
 * BRUTA: a ferramenta já guarda as alíquotas e o P&L trata dedução como linha
 * própria, então gravar a líquida perderia a dedução pelo caminho.
 *
 * Colunas são localizadas pelo texto do cabeçalho, nunca por índice: as abas
 * desta pasta começam fora da coluna A e o índice escorrega sem dar erro.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

const ABA = 'Receita'
const TIPO = 'receita'

const semAcento = (v) => String(v).normalize('NFD').replace(/\p{Diacritic}/gu, '')
const lim = (v) => semAcento(v).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

function lerAba(caminho) {
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

  const r = XLSX.utils.decode_range(aba['!ref'])
  const bruto = (l, c) => aba[`${XLSX.utils.encode_col(c)}${l}`]
  const texto = (l, c) => {
    const x = bruto(l, c)
    return x?.v == null ? '' : String(x.v).split(/\s+/).filter(Boolean).join(' ')
  }
  const numero = (l, c) => {
    const x = bruto(l, c)
    return typeof x?.v === 'number' ? x.v : null
  }

  // cabeçalho: a linha que contém "Tipo Receita"
  let cab = -1
  for (let l = r.s.r + 1; l <= r.e.r + 1 && cab === -1; l++) {
    for (let c = r.s.c; c <= r.e.c; c++) if (lim(texto(l, c)) === 'TIPO RECEITA') { cab = l; break }
  }
  if (cab === -1) throw new Error('não achei a linha de cabeçalho (célula "Tipo Receita")')

  const col = {}
  for (let c = r.s.c; c <= r.e.c; c++) {
    const k = lim(texto(cab, c))
    if (k && col[k] === undefined) col[k] = c
  }

  // Os 12 meses da receita BRUTA: primeira sequência de 12 datas no cabeçalho.
  const datas = []
  for (let c = r.s.c; c <= r.e.c; c++) {
    const x = bruto(cab, c)
    if (typeof x?.v === 'number' && x.v > 40000 && x.v < 60000) datas.push(c)
    else if (datas.length >= 12) break
    else if (datas.length) datas.length = 0 // sequência quebrou antes de 12
  }
  if (datas.length < 12) throw new Error(`achei ${datas.length} colunas de mês no cabeçalho, esperava 12`)
  const meses = datas.slice(0, 12)

  const exigidas = ['TIPO RECEITA', 'CONTA CONTABIL', 'EMPRESA', 'PRODUTO ANALITICO', 'RAZAO SOCIAL CLIENTE', 'OBS']
  for (const e of exigidas) if (col[e] === undefined) throw new Error(`coluna "${e}" não encontrada no cabeçalho`)

  const linhas = []
  for (let l = cab + 1; l <= r.e.r + 1; l++) {
    const empresa = texto(l, col.EMPRESA)
    const tipoReceita = texto(l, col['TIPO RECEITA'])
    // "x" é a linha separadora do template, não um dado
    if (!empresa || lim(empresa) === 'X' || lim(tipoReceita) === 'X') continue

    const valores = meses.map((c, i) => ({ mes: i + 1, valor: numero(l, c) ?? 0 }))
    if (!valores.some((v) => v.valor !== 0)) continue

    linhas.push({
      linha: l,
      tipoReceita,
      contaRotulo: texto(l, col['CONTA CONTABIL']),
      empresa,
      produtoSintetico: texto(l, col['PRODUTO SINTETICO'] ?? -1),
      produtoAnalitico: texto(l, col['PRODUTO ANALITICO']),
      cliente: texto(l, col['RAZAO SOCIAL CLIENTE']),
      obs: texto(l, col.OBS),
      valores,
    })
  }
  return linhas
}

// ---------------------------------------------------------------- main

const caminho = process.argv[2]
const aplicar = process.argv.includes('--aplicar')

if (!caminho) {
  console.error('uso: node --env-file=.env scripts/importar-receita.mjs "<Template Budget .xlsb>" [--aplicar]')
  process.exit(1)
}

const linhas = lerAba(caminho)
console.log(`aba ................... ${ABA}`)
console.log(`linhas com valor ...... ${linhas.length}`)
if (!linhas.length) {
  console.log('\nnada a importar: a aba não tem linha preenchida com valor mensal.')
  process.exit(0)
}

const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !anon) {
  console.error('faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — rode com "node --env-file=.env".')
  process.exit(1)
}
const sb = createClient(url, anon)

const [emps, contas, ciclos] = await Promise.all([
  sb.from('empresa').select('id, nome, bu_id, torre_id, sub_torre_id'),
  sb.from('conta').select('id, codigo, nome, linha_pl'),
  sb.from('ciclo').select('id, ano, status, versao(id, nome, status)'),
])
for (const x of [emps, contas, ciclos]) {
  if (x.error) {
    console.error(`erro ao ler: ${x.error.message}`)
    process.exit(1)
  }
}

const ciclo = ciclos.data.find((c) => c.status !== 'encerrado')
const versao = ciclo?.versao?.find((v) => v.status === 'ativa')
if (!versao) {
  console.error('não há versão ativa num ciclo aberto — crie em Budget Settings antes de importar.')
  process.exit(1)
}
console.log(`ciclo/versão .......... ${ciclo.ano} / ${versao.nome}`)

const porEmpresa = new Map(emps.data.map((e) => [lim(e.nome), e]))
const contasReceita = contas.data.filter((c) => (c.linha_pl || '').startsWith('Receita'))

/** Entre candidatos de mesmo nome, fica o de código mais curto: é a conta base,
 *  e não a sub-conta de provisão/reversão. */
function acharConta(rotulo) {
  const iguais = contasReceita.filter((c) => lim(c.nome) === lim(rotulo))
  if (!iguais.length) return null
  return iguais.sort((a, b) => a.codigo.length - b.codigo.length || a.codigo.localeCompare(b.codigo))[0]
}

const prontos = []
const problemas = []
for (const l of linhas) {
  const empresa = porEmpresa.get(lim(l.empresa))
  const conta = acharConta(l.contaRotulo)
  const falhas = []
  if (!empresa) falhas.push(`empresa "${l.empresa}" não existe no cadastro`)
  if (!conta) falhas.push(`"${l.contaRotulo}" não casa com nenhuma conta de receita`)
  if (falhas.length) {
    problemas.push({ linha: l.linha, falhas })
    continue
  }
  const total = l.valores.reduce((a, v) => a + v.valor, 0)
  prontos.push({ origem: l, empresa, conta, total })
}

console.log(`\nresolvidas ............ ${prontos.length}`)
console.log(`com problema .......... ${problemas.length}`)
for (const p of problemas) console.log(`    linha ${p.linha}: ${p.falhas.join(' | ')}`)

for (const p of prontos) {
  console.log(
    `\n  linha ${p.origem.linha}` +
      `\n    empresa .... ${p.empresa.nome}` +
      `\n    conta ...... ${p.conta.codigo} ${p.conta.nome}   (de "${p.origem.contaRotulo}")` +
      `\n    produto .... ${p.origem.produtoAnalitico || p.origem.produtoSintetico || '—'}` +
      `\n    tipo ....... ${p.origem.tipoReceita}` +
      `\n    total ano .. ${p.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  )
}

if (problemas.length) {
  console.log('\nabortado: resolva as pendências acima antes de importar.')
  process.exit(1)
}

if (!aplicar) {
  console.log('\nsem --aplicar: nada foi gravado.')
  process.exit(0)
}

let criados = 0
for (const p of prontos) {
  // Produto e cliente não têm coluna em `lancamento`; vão para descrição e obs
  // para não se perderem. Quando a tabela ganhar produto_id/cliente_id, é para
  // lá que devem migrar.
  const descricao = [p.origem.produtoAnalitico || p.origem.produtoSintetico, p.origem.tipoReceita]
    .filter(Boolean)
    .join(' · ')
  const obs = [p.origem.cliente && `Cliente: ${p.origem.cliente}`, p.origem.obs].filter(Boolean).join(' | ')

  const { data, error } = await sb
    .from('lancamento')
    .insert({
      versao_id: versao.id,
      tipo: TIPO,
      bu_id: p.empresa.bu_id,
      torre_id: p.empresa.torre_id,
      sub_torre_id: p.empresa.sub_torre_id,
      empresa_id: p.empresa.id,
      conta_id: p.conta.id,
      descricao: descricao || null,
      obs: obs || null,
    })
    .select('id')
    .single()
  if (error) {
    console.error(`\nerro ao criar lançamento da linha ${p.origem.linha}: ${error.message}`)
    process.exit(1)
  }

  const mensais = p.origem.valores.map((v) => ({ lancamento_id: data.id, mes: v.mes, valor: v.valor }))
  const { error: erroMes } = await sb.from('lancamento_valor_mensal').insert(mensais)
  if (erroMes) {
    console.error(`\nerro ao gravar valores mensais da linha ${p.origem.linha}: ${erroMes.message}`)
    process.exit(1)
  }
  criados += 1
}

const { count } = await sb.from('lancamento').select('*', { count: 'exact', head: true }).eq('tipo', TIPO)
console.log(`\ncriados ............... ${criados}`)
console.log(`lançamentos de receita  ${count}`)
