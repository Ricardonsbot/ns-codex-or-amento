/**
 * Le uma pasta de Templates Budget e diz, sem gravar nada, o que cada arquivo
 * traz e o que falta cadastrar para ele entrar.
 *
 * Uso:
 *   cd app
 *   node --env-file=.env scripts/conferir-pasta-templates.mjs "<pasta>"
 *
 * Serve para decidir a ordem das coisas antes de importar em lote: quais
 * empresas precisam existir, quais contas faltam no plano e quantas linhas
 * cada aba tem.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { lerPlanilha, TEMPLATE } from '../src/lib/lerTemplateOrcamento.js'
import { casar } from '../src/lib/casarTemplateOrcamento.js'

const pasta = process.argv[2]
if (!pasta) {
  console.error('uso: node --env-file=.env scripts/conferir-pasta-templates.mjs "<pasta>"')
  process.exitCode = 1
}

const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
const sb = createClient(url, anon)

const [emps, contas] = await Promise.all([
  sb.from('empresa').select('id, nome, bu_id, torre_id, sub_torre_id'),
  sb.from('conta').select('id, codigo, nome, linha_pl'),
])
for (const x of [emps, contas]) {
  if (x.error) {
    console.error(`erro ao ler: ${x.error.message}`)
    process.exitCode = 1
  }
}

const arquivos = readdirSync(pasta).filter((f) => /\.xlsb$|\.xlsx$/i.test(f) && !f.startsWith('~$'))
const empresasFaltando = new Set()
const contasFaltando = new Map()

for (const arquivo of arquivos) {
  console.log(`\n=== ${arquivo}`)
  const buf = readFileSync(join(pasta, arquivo))
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)

  for (const tipo of Object.keys(TEMPLATE)) {
    let lido
    try {
      lido = lerPlanilha(ab, tipo)
    } catch (e) {
      console.log(`  ${tipo.padEnd(8)} erro: ${e.message}`)
      continue
    }
    const { prontas, marcadas, fora } = casar(lido, { empresas: emps.data, contas: contas.data })
    console.log(
      `  ${tipo.padEnd(8)} ${String(lido.linhas.length).padStart(5)} linha(s)   ` +
        `ok ${String(prontas.length).padStart(5)}   sem conta ${String(marcadas.length).padStart(4)}   ` +
        `sem empresa ${String(fora.length).padStart(5)}`
    )
    for (const p of fora) {
      const m = p.falhas.find((f) => f.startsWith('Empresa'))
      if (m) empresasFaltando.add(m.replace(/^Empresa "|" não está cadastrada$/g, ''))
    }
    for (const p of marcadas) {
      const chave = p.contaCodigo || p.contaRotulo
      if (!chave) continue
      const atual = contasFaltando.get(chave) ?? { linhas: 0, exemplo: p.contaRotulo }
      atual.linhas += 1
      contasFaltando.set(chave, atual)
    }
  }
}

console.log('\n=== empresas que precisam ser cadastradas')
for (const e of [...empresasFaltando].sort()) console.log(`  ${e}`)
if (!empresasFaltando.size) console.log('  (nenhuma)')

console.log('\n=== contas que precisam entrar no plano')
for (const [k, v] of [...contasFaltando].sort((a, b) => b[1].linhas - a[1].linhas)) {
  console.log(`  ${String(v.linhas).padStart(5)} linha(s)  ${k}  ${v.exemplo ?? ''}`)
}
if (!contasFaltando.size) console.log('  (nenhuma)')
