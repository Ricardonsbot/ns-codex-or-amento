/**
 * Troca os lançamentos de uma empresa numa versão pelos de um arquivo.
 *
 * Serve para quando os dados de uma empresa vieram de um template antigo e o
 * arquivo atual e outro — foi o caso da BRK, gravada de uma versao que nao
 * estava na pasta e que divergia em milhares de linhas.
 *
 * Apaga e reimporta, nesta ordem, e so dentro do recorte (versao ativa +
 * empresa): nao encosta em outras empresas nem em outras versoes. Os valores
 * mensais saem junto pelo `on delete cascade`.
 *
 * Uso:
 *   cd app
 *   node --env-file=.env scripts/substituir-empresa.mjs "<Empresa>" "<Template .xlsb>"
 *   node --env-file=.env scripts/substituir-empresa.mjs "<Empresa>" "<Template>" --aplicar
 *
 * Sem --aplicar so mostra o que sairia e o que entraria.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { lerPlanilha, TEMPLATE } from '../src/lib/lerTemplateOrcamento.js'
import {
  casar,
  EXTRA_LANCAMENTO,
  EXTRA_MENSAL,
  EXTRA_AREA,
  EXTRA_PACOTE,
  EXTRA_TEMPLATE,
} from '../src/lib/casarTemplateOrcamento.js'
import { gravarEmLote } from '../src/lib/gravarLancamentos.js'

const nomeEmpresa = process.argv[2]
const caminho = process.argv[3]
const aplicar = process.argv.includes('--aplicar')
if (!nomeEmpresa || !caminho) {
  console.error('uso: node --env-file=.env scripts/substituir-empresa.mjs "<Empresa>" "<Template>" [--aplicar]')
  throw new Error('argumentos faltando')
}

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

const { data: empresa, error: e1 } = await sb
  .from('empresa')
  .select('id, nome, bu_id, torre_id, sub_torre_id')
  .ilike('nome', nomeEmpresa)
  .single()
if (e1) throw new Error(`empresa "${nomeEmpresa}": ${e1.message}`)

const { data: ciclos, error: e2 } = await sb.from('ciclo').select('id, ano, status, versao(id, nome, status)')
if (e2) throw new Error(e2.message)
const ciclo = ciclos.find((c) => c.status !== 'encerrado')
const versao = ciclo?.versao?.find((v) => v.status === 'ativa')
if (!versao) throw new Error('não há versão ativa num ciclo aberto')

console.log(`empresa ............... ${empresa.nome}`)
console.log(`ciclo/versão .......... ${ciclo.ano} / ${versao.nome}`)

// ---- o que sai --------------------------------------------------------------
const atuais = []
for (let de = 0; ; de += 1000) {
  const { data, error } = await sb
    .from('lancamento')
    .select('id, tipo, lancamento_valor_mensal(valor)')
    .eq('versao_id', versao.id)
    .eq('empresa_id', empresa.id)
    .range(de, de + 999)
  if (error) throw new Error(error.message)
  atuais.push(...data)
  if (data.length < 1000) break
}
const soma = (l) => (l.lancamento_valor_mensal ?? []).reduce((a, x) => a + Number(x.valor), 0)
const resumo = (linhas) => {
  const por = {}
  for (const l of linhas) {
    por[l.tipo] = por[l.tipo] ?? { n: 0, v: 0 }
    por[l.tipo].n += 1
    por[l.tipo].v += soma(l)
  }
  return por
}
console.log('\nsai (o que está gravado hoje):')
for (const [t, x] of Object.entries(resumo(atuais))) {
  console.log(`   ${t.padEnd(9)} ${String(x.n).padStart(5)} linha(s)   R$ ${(x.v / 1e6).toFixed(3)} mi`)
}
if (!atuais.length) console.log('   (nada)')

// ---- o que entra ------------------------------------------------------------
const buf = readFileSync(caminho)
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)

const [emps, contas] = await Promise.all([
  sb.from('empresa').select('id, nome, bu_id, torre_id, sub_torre_id'),
  sb.from('conta').select('id, codigo, nome, linha_pl'),
])

const aGravar = []
console.log('\nentra (o arquivo):')
for (const tipo of Object.keys(TEMPLATE)) {
  let lido
  try {
    lido = lerPlanilha(ab, tipo)
  } catch (err) {
    console.log(`   ${tipo.padEnd(9)} erro: ${err.message}`)
    continue
  }
  const { prontas, marcadas, fora } = casar(lido, { empresas: emps.data, contas: contas.data })
  const desta = [...prontas, ...marcadas].filter((p) => p.empresa.id === empresa.id)
  const deOutras = [...prontas, ...marcadas].length - desta.length
  const total = desta.reduce((a, p) => a + p.total, 0)
  console.log(
    `   ${tipo.padEnd(9)} ${String(desta.length).padStart(5)} linha(s)   R$ ${(total / 1e6).toFixed(3)} mi` +
      (deOutras ? `   (${deOutras} de outra empresa, ignoradas)` : '') +
      (fora.length ? `   (${fora.length} sem empresa)` : '')
  )
  if (desta.length) aGravar.push({ tipo, linhas: desta })
}

if (!aplicar) {
  console.log('\nsem --aplicar: nada foi apagado nem gravado.')
} else {
  if (!aGravar.length) {
    // Apagar sem ter o que por no lugar deixaria a empresa vazia por engano.
    throw new Error('o arquivo não tem nenhuma linha desta empresa — nada foi apagado')
  }

  const ids = atuais.map((l) => l.id)
  let apagados = 0
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb
      .from('lancamento')
      .delete()
      .in('id', ids.slice(i, i + 200))
      .select('id')
    if (error) throw new Error(`apagando: ${error.message}`)
    apagados += data.length
    process.stdout.write(`\r  apagando ... ${apagados}/${ids.length}`)
  }
  process.stdout.write('\n')

  const [pa, pb, pc, pd, pe] = await Promise.all([
    sb.from('lancamento').select(EXTRA_LANCAMENTO.join(',')).limit(1),
    sb.from('lancamento_valor_mensal').select(EXTRA_MENSAL.join(',')).limit(1),
    sb.from('lancamento').select(EXTRA_AREA.join(',')).limit(1),
    sb.from('lancamento').select(EXTRA_PACOTE.join(',')).limit(1),
    sb.from('lancamento').select(EXTRA_TEMPLATE.join(',')).limit(1),
  ])
  const sup = {
    lancamento: !pa.error,
    mensal: !pb.error,
    area: !pc.error,
    pacote: !pd.error,
    template: !pe.error,
  }

  let criados = 0
  for (const { tipo, linhas } of aGravar) {
    const feitos = await gravarEmLote(sb, linhas, versao.id, tipo, sup, (n, t) =>
      process.stdout.write(`\r  gravando ${tipo} ... ${n}/${t}`)
    )
    process.stdout.write('\n')
    criados += feitos.length
  }

  console.log(`\napagados .............. ${apagados}`)
  console.log(`criados ............... ${criados}`)
}
