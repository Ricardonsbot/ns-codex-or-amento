/**
 * Reconstrói a hierarquia BU → Torre → Sub Torre → Empresa a partir da aba
 * "Mapa Torres Empresas Gerenciais" do Template Budget.
 *
 * Uso:
 *   cd app
 *   node --env-file=.env scripts/importar-hierarquia.mjs "<Template Budget .xlsb>"
 *   node --env-file=.env scripts/importar-hierarquia.mjs "<Template Budget .xlsb>" --aplicar
 *
 * Sem --aplicar só planeja e imprime; nada é gravado.
 *
 * O script é DELIBERADAMENTE ADITIVO: renomeia e insere, nunca apaga.
 *
 *   - Casa o que existe com o que o mapa pede, por nome normalizado dentro do
 *     pai. Quando a grafia difere, RENOMEIA no lugar em vez de recriar — assim o
 *     id se mantém e os lançamentos que apontam para a linha continuam válidos.
 *   - Insere o que falta, de cima para baixo, porque o filho precisa do id do pai.
 *   - O que sobra é apenas LISTADO no fim, com a marca de quem está referenciado
 *     por lançamento. Apagar estrutura de orçamento em banco compartilhado é
 *     decisão de gente, não de script: `lancamento` tem FK sem ON DELETE para as
 *     quatro tabelas, e uma remoção errada leva lançamento junto.
 *
 * A normalização ignora acento, caixa e um prefixo "Torre " — é o que faz
 * "ICP Pequeno e Micro" casar com "Torre ICP Pequeno e Micro" e "Torre Fintech"
 * com "Fintech", que são a mesma coisa grafada de dois jeitos.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

const ABA = 'Mapa Torres Empresas Gerenciais'
const COL = { bu: 'C', torre: 'D', subtorre: 'E', antes: 'G', depois: 'H' }

const semAcento = (v) => String(v).normalize('NFD').replace(/\p{Diacritic}/gu, '')
const limpo = (v) => semAcento(v).toUpperCase().split(/\s+/).filter(Boolean).join(' ')
const chave = (v) => limpo(v).replace(/^TORRE /, '')

function lerMapa(caminho) {
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
  const cel = (l, c) => {
    const x = aba[`${c}${l}`]
    return x?.v == null ? '' : String(x.v).split(/\s+/).filter(Boolean).join(' ')
  }
  const cab = (() => {
    for (let l = intervalo.s.r + 1; l <= intervalo.e.r + 1; l++) if (cel(l, COL.bu) === 'BU') return l
    throw new Error(`não achei o cabeçalho (célula "BU" na coluna ${COL.bu})`)
  })()

  const linhas = []
  for (let l = cab + 1; l <= intervalo.e.r + 1; l++) {
    const bu = cel(l, COL.bu)
    const empresa = cel(l, COL.depois)
    if (!bu || !empresa) continue
    linhas.push({ bu, torre: cel(l, COL.torre), subtorre: cel(l, COL.subtorre), empresa, antes: cel(l, COL.antes) })
  }
  return linhas
}

// ---------------------------------------------------------------- main

const caminho = process.argv[2]
const aplicar = process.argv.includes('--aplicar')

if (!caminho) {
  console.error('uso: node --env-file=.env scripts/importar-hierarquia.mjs "<Template Budget .xlsb>" [--aplicar]')
  process.exit(1)
}

const mapa = lerMapa(caminho)

const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !anon) {
  console.error('faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — rode com "node --env-file=.env".')
  process.exit(1)
}
const sb = createClient(url, anon)

const [bus, torres, subs, emps, lancs] = await Promise.all([
  sb.from('bu').select('id, nome'),
  sb.from('torre').select('id, nome, bu_id'),
  sb.from('sub_torre').select('id, nome, torre_id'),
  sb.from('empresa').select('id, nome, bu_id, torre_id, sub_torre_id'),
  sb.from('lancamento').select('bu_id, torre_id, sub_torre_id, empresa_id'),
])
for (const r of [bus, torres, subs, emps, lancs]) {
  if (r.error) {
    console.error(`erro ao ler: ${r.error.message}`)
    process.exit(1)
  }
}

const referenciados = new Set()
for (const l of lancs.data) {
  for (const id of [l.bu_id, l.torre_id, l.sub_torre_id, l.empresa_id]) if (id) referenciados.add(id)
}

const renomear = []
const inserir = []
const sobrando = []
const reposicionados = []

function casar(tabela, atuais, desejados, paiDe) {
  const porChave = new Map(atuais.map((r) => [`${paiDe(r) ?? ''}|${chave(r.nome)}`, r]))
  const usados = new Set()
  for (const d of desejados) {
    // Tenta pelo nome novo e, se não achar, pelos nomes antigos que o mapa
    // declara na coluna "Empresa Gerencial Antes". Sem isso "Hivecloud" e
    // "Hive" viram duas empresas em vez de uma renomeada — foi o que aconteceu
    // na primeira reconstrução.
    let atual = porChave.get(`${d.pai ?? ''}|${chave(d.nome)}`)
    for (const alt of d.alternativos ?? []) {
      if (atual) break
      const candidato = porChave.get(`${d.pai ?? ''}|${chave(alt)}`)
      if (candidato && !usados.has(candidato.id)) atual = candidato
    }
    if (!atual) {
      inserir.push({ tabela, alvo: d })
      continue
    }
    usados.add(atual.id)
    d.id = atual.id
    d.atual = atual
    if (limpo(atual.nome) !== limpo(d.nome)) renomear.push({ tabela, id: atual.id, de: atual.nome, para: d.nome })
  }
  for (const r of atuais) {
    if (!usados.has(r.id)) sobrando.push({ tabela, nome: r.nome, preso: referenciados.has(r.id) })
  }
}

const unicos = (k, monta) => [...new Map(mapa.map((l) => [k(l), monta(l)])).values()]

/**
 * Linha existente também é REPOSICIONADA, não só renomeada: casar por nome não
 * garante que o pai esteja certo. Sem isto, empresas que já existiam ficavam no
 * lugar antigo — Buonny sem sub torre, os do VGR em "Núcleo VGR" em vez de
 * "Torre VGR" — e a árvore saía metade nova, metade velha.
 */
async function aplicarNivel(tabela, montaLinha, desejados) {
  if (!aplicar) return

  for (const d of desejados) {
    if (!d.atual) continue
    const alvo = montaLinha(d)
    const difere = Object.entries(alvo).some(([campo, valor]) => (d.atual[campo] ?? null) !== (valor ?? null))
    if (!difere) continue
    const { error } = await sb.from(tabela).update(alvo).eq('id', d.id)
    if (error) {
      console.error(`erro ao atualizar ${tabela} "${d.nome}": ${error.message}`)
      process.exit(1)
    }
    reposicionados.push({ tabela, nome: d.nome })
  }

  const pendentes = inserir.filter((i) => i.tabela === tabela)
  if (!pendentes.length) return
  const { data, error } = await sb.from(tabela).insert(pendentes.map((p) => montaLinha(p.alvo))).select('id')
  if (error) {
    console.error(`erro ao inserir em ${tabela}: ${error.message}`)
    process.exit(1)
  }
  pendentes.forEach((p, i) => {
    p.alvo.id = data[i].id
  })
}

// nível 1: BU
const dBus = unicos((l) => chave(l.bu), (l) => ({ nome: l.bu, pai: '' }))
casar('bu', bus.data, dBus, () => '')
await aplicarNivel('bu', (d) => ({ nome: d.nome }), dBus)
const idBu = new Map(dBus.map((b) => [chave(b.nome), b.id]))

// nível 2: Torre
const dTorres = unicos(
  (l) => `${chave(l.bu)}|${chave(l.torre)}`,
  (l) => ({ nome: l.torre, pai: idBu.get(chave(l.bu)), buChave: chave(l.bu) })
)
casar('torre', torres.data, dTorres, (r) => r.bu_id)
await aplicarNivel('torre', (d) => ({ nome: d.nome, bu_id: idBu.get(d.buChave) }), dTorres)
const idTorre = new Map(dTorres.map((t) => [`${t.buChave}|${chave(t.nome)}`, t.id]))

// nível 3: Sub Torre
const dSubs = unicos(
  (l) => `${chave(l.bu)}|${chave(l.torre)}|${chave(l.subtorre)}`,
  (l) => ({
    nome: l.subtorre,
    pai: idTorre.get(`${chave(l.bu)}|${chave(l.torre)}`),
    torreChave: `${chave(l.bu)}|${chave(l.torre)}`,
  })
).filter((s) => s.nome)
casar('sub_torre', subs.data, dSubs, (r) => r.torre_id)
await aplicarNivel('sub_torre', (d) => ({ nome: d.nome, torre_id: idTorre.get(d.torreChave) }), dSubs)
const idSub = new Map(dSubs.map((s) => [`${s.torreChave}|${chave(s.nome)}`, s.id]))

// nível 4: Empresa
const dEmps = unicos((l) => chave(l.empresa), (l) => ({
  nome: l.empresa,
  // nome antigo declarado no mapa: permite renomear no lugar em vez de duplicar
  alternativos: l.antes && chave(l.antes) !== chave(l.empresa) ? [l.antes] : [],
  pai: '',
  buChave: chave(l.bu),
  torreChave: `${chave(l.bu)}|${chave(l.torre)}`,
  subChave: `${chave(l.bu)}|${chave(l.torre)}|${chave(l.subtorre)}`,
}))
casar('empresa', emps.data, dEmps, () => '')
await aplicarNivel('empresa', (d) => ({
  nome: d.nome,
  bu_id: idBu.get(d.buChave),
  torre_id: idTorre.get(d.torreChave) ?? null,
  sub_torre_id: idSub.get(d.subChave) ?? null,
}), dEmps)

// ---------------------------------------------------------------- relatório
console.log(`aba ................... ${ABA}`)
console.log(`linhas do mapa ........ ${mapa.length}`)
console.log(`o mapa pede ........... ${dBus.length} BUs, ${dTorres.length} torres, ${dSubs.length} sub torres, ${dEmps.length} empresas`)

console.log(`\nrenomear .............. ${renomear.length}`)
for (const r of renomear) console.log(`    ${r.tabela.padEnd(10)} "${r.de}" -> "${r.para}"`)

console.log(`reposicionar .......... ${reposicionados.length}`)
for (const r of reposicionados) console.log(`    ${r.tabela.padEnd(10)} ${r.nome}`)
console.log(`inserir ............... ${inserir.length}`)
for (const t of ['bu', 'torre', 'sub_torre', 'empresa']) {
  const n = inserir.filter((i) => i.tabela === t).length
  if (n) console.log(`    ${t.padEnd(10)} ${n}`)
}

console.log(`\nfora do mapa (NÃO removidos) ... ${sobrando.length}`)
for (const s of sobrando) {
  console.log(`    ${s.tabela.padEnd(10)} ${s.nome}${s.preso ? '   [referenciado por lançamento]' : ''}`)
}

if (!aplicar) {
  console.log('\nsem --aplicar: nada foi gravado.')
  process.exit(0)
}

const contagem = {}
for (const t of ['bu', 'torre', 'sub_torre', 'empresa']) {
  const { count } = await sb.from(t).select('*', { count: 'exact', head: true })
  contagem[t] = count
}
console.log('\naplicado (renomeações e inserções). Agora no Supabase:', contagem)
