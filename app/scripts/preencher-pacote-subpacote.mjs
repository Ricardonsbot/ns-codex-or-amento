/**
 * Preenche `pacote` e `subpacote` nos lançamentos que já estão gravados.
 *
 * Até a migração 2026-09-10 as duas dimensões existiam no template mas eram
 * guardadas dentro de texto: PACOTE ia para `obs` como "Pacote: X | Produto: Y"
 * e SUBPACOTE era colado em `descricao` como "DETALHAMENTO · SUBPACOTE". Dá
 * para ler, mas não dá para somar — e o P&L por pacote precisa somar.
 *
 * Reimportar resolveria, mas apagaria lançamentos que já foram conferidos. Em
 * vez disso:
 *
 *   pacote     sai do próprio `obs`, com a marca que a ferramenta escreveu;
 *   subpacote  sai de um mapa descricao -> subpacote montado lendo os mesmos
 *              templates, porque `descricao` é determinística a partir do par
 *              (DETALHAMENTO, SUBPACOTE).
 *
 * Uma `descricao` que dois pares diferentes produzem é ambígua — "Facilities"
 * pode ser detalhamento sozinho ou subpacote sozinho — e essas ficam de fora,
 * contadas no relatório. Nada é adivinhado.
 *
 * Uso:
 *   cd app
 *   node --env-file=.env scripts/preencher-pacote-subpacote.mjs "<pasta de templates>"
 *   node --env-file=.env scripts/preencher-pacote-subpacote.mjs "<pasta>" --aplicar
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { lerPlanilha, TEMPLATE } from '../src/lib/lerTemplateOrcamento.js'

const pasta = process.argv[2]
const aplicar = process.argv.includes('--aplicar')
if (!pasta) {
  console.error('uso: node --env-file=.env scripts/preencher-pacote-subpacote.mjs "<pasta>" [--aplicar]')
  process.exitCode = 1
}

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

const { error: semColuna } = await sb.from('lancamento').select('pacote, subpacote').limit(1)
if (semColuna) {
  console.error('as colunas pacote/subpacote ainda não existem — rode supabase/migrations/2026-09-10-schema-completo-do-template.sql')
  process.exitCode = 1
  // Sem as colunas nao ha o que preencher; seguir so gastaria minutos lendo
  // os templates para falhar no update no fim.
  throw new Error('migração pendente')
}

// ---- mapa descricao -> subpacote, lido dos templates ------------------------
const candidatos = new Map() // descricao -> Set(subpacote)
const arquivos = readdirSync(pasta).filter((f) => /\.xlsb$|\.xlsx$/i.test(f) && !f.startsWith('~$'))
for (const arquivo of arquivos) {
  const buf = readFileSync(join(pasta, arquivo))
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  for (const tipo of ['despesa', 'capex']) {
    if (!TEMPLATE[tipo]) continue
    let lido
    try {
      lido = lerPlanilha(ab, tipo)
    } catch {
      continue
    }
    for (const l of lido.linhas) {
      if (!l.descricao || !l.subpacote) continue
      if (!candidatos.has(l.descricao)) candidatos.set(l.descricao, new Set())
      candidatos.get(l.descricao).add(l.subpacote)
    }
  }
  console.log(`lido ${arquivo}`)
}

const mapa = new Map()
const subpacotesConhecidos = new Set()
let ambiguas = 0
for (const [d, sub] of candidatos) {
  for (const x of sub) subpacotesConhecidos.add(x)
  if (sub.size === 1) mapa.set(d, [...sub][0])
  else ambiguas += 1
}
console.log(`\ndescrições mapeadas ... ${mapa.size}`)
console.log(`ambíguas (ignoradas) .. ${ambiguas}`)
console.log(`subpacotes conhecidos . ${subpacotesConhecidos.size}`)

/**
 * O subpacote de uma descrição.
 *
 * Primeiro pelo mapa exato. Se a linha veio de um arquivo que não está nesta
 * pasta — foi o caso da BRK, gravada de uma versão anterior do template —, a
 * combinação não consta do mapa, mas a descrição continua sendo
 * "DETALHAMENTO · SUBPACOTE": basta pegar o último trecho.
 *
 * Só que "Facilities" sozinho pode ser detalhamento ou subpacote, e aí
 * adivinhar erraria. Por isso o trecho só é aceito quando é um subpacote que
 * apareceu em algum template — a lista montada acima. Fora disso, fica nulo.
 */
function subpacoteDe(descricao) {
  const d = descricao ?? ''
  const exato = mapa.get(d)
  if (exato) return { valor: exato, via: 'mapa' }
  const partes = d.split(' · ')
  if (partes.length > 1) {
    const ultimo = partes[partes.length - 1].trim()
    if (subpacotesConhecidos.has(ultimo)) return { valor: ultimo, via: 'sufixo' }
  }
  return { valor: null, via: 'nenhum' }
}

// ---- lê o que está gravado --------------------------------------------------
const linhas = []
for (let de = 0; ; de += 1000) {
  const { data, error } = await sb
    .from('lancamento')
    .select('id, tipo, descricao, obs, pacote, subpacote')
    .neq('tipo', 'receita')
    .range(de, de + 999)
  if (error) throw new Error(error.message)
  linhas.push(...data)
  if (data.length < 1000) break
}
console.log(`lançamentos não-receita  ${linhas.length}`)

// ---- decide o par de cada linha e agrupa ------------------------------------
// A chave junta os dois com um separador que nao aparece em texto de
// planilha. Um espaco nao serviria: "Personnel Costs" ja tem um, e o split
// cortaria no lugar errado.
const SEP = String.fromCharCode(0)
const porPar = new Map() // `pacote${SEP}subpacote` -> [ids]
let semPacote = 0
let semSubpacote = 0
const via = { mapa: 0, sufixo: 0, nenhum: 0 }
for (const l of linhas) {
  const m = /Pacote:\s*([^|]+)/.exec(l.obs ?? '')
  const pacote = m ? m[1].trim() : null
  const achado = subpacoteDe(l.descricao)
  const subpacote = achado.valor
  via[achado.via] += 1
  if (!pacote) semPacote += 1
  if (!subpacote) semSubpacote += 1
  if (!pacote && !subpacote) continue
  if (l.pacote === pacote && l.subpacote === subpacote) continue
  const chave = `${pacote ?? ''}${SEP}${subpacote ?? ''}`
  if (!porPar.has(chave)) porPar.set(chave, [])
  porPar.get(chave).push(l.id)
}

console.log(`\nsem pacote no obs ...... ${semPacote}`)
console.log(`subpacote pelo mapa .... ${via.mapa}`)
console.log(`subpacote pelo sufixo .. ${via.sufixo}`)
console.log(`sem subpacote .......... ${semSubpacote}`)
console.log(`pares distintos ........ ${porPar.size}`)
for (const [chave, ids] of [...porPar].sort((a, b) => b[1].length - a[1].length).slice(0, 15)) {
  const [p, s] = chave.split(SEP)
  console.log(`  ${String(ids.length).padStart(5)}  ${p || '—'}  ›  ${s || '—'}`)
}
if (porPar.size > 15) console.log(`  ... e mais ${porPar.size - 15} par(es)`)

if (!aplicar) {
  console.log('\nsem --aplicar: nada foi gravado.')
} else {
  // Uma chamada por par, com os ids em `in`. Sao dezenas de pares para milhares
  // de linhas — um update por linha levaria minutos.
  const LOTE = 200
  let feitos = 0
  for (const [chave, ids] of porPar) {
    const [p, s] = chave.split(SEP)
    for (let i = 0; i < ids.length; i += LOTE) {
      const fatia = ids.slice(i, i + LOTE)
      const { error } = await sb
        .from('lancamento')
        .update({ pacote: p || null, subpacote: s || null })
        .in('id', fatia)
      if (error) throw new Error(`atualizando ${p} › ${s}: ${error.message}`)
      feitos += fatia.length
      process.stdout.write(`\r  gravando ... ${feitos}`)
    }
  }
  process.stdout.write('\n')
  console.log(`\natualizados ............ ${feitos}`)
}
