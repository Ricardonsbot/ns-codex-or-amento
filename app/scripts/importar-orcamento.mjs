/**
 * Importa uma aba de lançamento do Template Budget para o módulo correspondente
 * (lancamento + lancamento_valor_mensal).
 *
 *   receita → aba "Receita"       despesa → aba "Base Gastos"     capex → aba "Capex"
 *
 * Uso:
 *   cd app
 *   node --env-file=.env scripts/importar-orcamento.mjs <tipo> "<Template Budget .xlsb>"
 *   node --env-file=.env scripts/importar-orcamento.mjs <tipo> "<Template Budget .xlsb>" --aplicar
 *
 * Sem --aplicar só planeja e imprime.
 *
 * A leitura e o casamento com os cadastros vêm dos mesmos módulos que a tela
 * usa (src/lib/lerTemplateOrcamento.js e casarTemplateOrcamento.js), para que
 * script e botão nunca divirjam.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { lerPlanilha, TEMPLATE } from '../src/lib/lerTemplateOrcamento.js'
import { casar, EXTRA_LANCAMENTO, EXTRA_MENSAL, EXTRA_AREA } from '../src/lib/casarTemplateOrcamento.js'
import { gravarEmLote } from '../src/lib/gravarLancamentos.js'

const tipo = process.argv[2]
const caminho = process.argv[3]
const aplicar = process.argv.includes('--aplicar')

if (!TEMPLATE[tipo] || !caminho) {
  console.error('uso: node --env-file=.env scripts/importar-orcamento.mjs <receita|despesa|capex> "<Template .xlsb>" [--aplicar]')
  process.exit(1)
}

let buffer
try {
  buffer = readFileSync(caminho)
} catch (err) {
  if (err.code === 'EBUSY' || err.code === 'EPERM') {
    console.error(`não consegui ler "${caminho}" — o arquivo está aberto no Excel? Feche e rode de novo.`)
    process.exit(1)
  }
  throw err
}

const lido = lerPlanilha(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), tipo)
console.log(`aba ................... ${lido.aba}`)
console.log(`ano no cabeçalho ...... ${lido.ano}`)
console.log(`linhas com valor ...... ${lido.linhas.length}`)
if (lido.ignoradas) {
  console.log(`ignoradas (sem valor)   ${lido.ignoradas}   <- tem dimensao preenchida mas nenhum mes`)
}
if (!lido.linhas.length) {
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
if (ciclo.ano !== lido.ano) {
  console.log(`AVISO: cabeçalho em ${lido.ano} e ciclo em ${ciclo.ano}. Os meses entram por posição (1ª coluna = janeiro).`)
}

const { prontas, marcadas, fora } = casar(lido, { empresas: emps.data, contas: contas.data })
const aImportar = [...prontas, ...marcadas]

console.log(`\nresolvidas ............ ${prontas.length}`)
console.log(`sem conta (marcadas) .. ${marcadas.length}`)
for (const p of marcadas.slice(0, 8)) console.log(`    linha ${p.linha}: ${p.falhas.join(' | ')}`)
if (marcadas.length > 8) console.log(`    ... e mais ${marcadas.length - 8}`)
console.log(`fora (sem empresa) .... ${fora.length}`)
for (const p of fora.slice(0, 8)) console.log(`    linha ${p.linha}: ${p.falhas.join(' | ')}`)
if (fora.length > 8) console.log(`    ... e mais ${fora.length - 8}`)

// Só uma amostra: em arquivo real são centenas de linhas.
for (const p of prontas.slice(0, 5)) {
  console.log(
    `\n  linha ${p.linha}` +
      `\n    empresa .... ${p.empresa.nome}` +
      `\n    conta ...... ${p.conta.codigo} ${p.conta.nome}   (de "${p.contaCodigo || p.contaRotulo}")` +
      `\n    descrição .. ${p.descricao || '—'}` +
      `\n    c. custo ... ${p.centroCusto || '—'}` +
      `\n    fornecedor . ${p.fornecedor || '—'}` +
      `\n    total ano .. ${p.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  )
}
if (prontas.length > 5) console.log(`\n  ... e mais ${prontas.length - 5} linha(s) resolvida(s)`)

// Daqui para baixo não se usa process.exit(): com os sockets do Supabase ainda
// abertos ele derruba o Node no Windows antes de terminar de imprimir. Marca-se
// o código de saída e deixa o módulo acabar sozinho.
if (!aImportar.length) {
  console.log('\nnada a importar.')
  process.exitCode = 1
} else if (!aplicar) {
  console.log('\nsem --aplicar: nada foi gravado.')
} else {
  // Enquanto a migracao 2026-09-08 nao rodar, as colunas dos blocos derivados
  // nao existem e mandá-las faria o PostgREST recusar o insert inteiro.
  const [pa, pb, pc] = await Promise.all([
    sb.from('lancamento').select(EXTRA_LANCAMENTO.join(',')).limit(1),
    sb.from('lancamento_valor_mensal').select(EXTRA_MENSAL.join(',')).limit(1),
    sb.from('lancamento').select(EXTRA_AREA.join(',')).limit(1),
  ])
  const sup = { lancamento: !pa.error, mensal: !pb.error, area: !pc.error }
  console.log(`coluna area ........... ${sup.area ? 'existe' : 'ainda nao existe — rode 2026-09-09-area-do-pl.sql'}`)
  const estado = sup.lancamento && sup.mensal
    ? 'existem, serão gravadas'
    : 'ainda não existem — rode supabase/migrations/2026-09-08-blocos-derivados.sql'
  console.log(`\ncolunas derivadas ..... ${estado}`)

  let criados = 0
  try {
    const ids = await gravarEmLote(sb, aImportar, versao.id, tipo, sup, (feitos, total) => {
      process.stdout.write(`\r  gravando ... ${feitos}/${total}`)
    })
    criados = ids.length
    process.stdout.write('\n')
  } catch (e) {
    console.error(`\n${e.message}`)
    process.exitCode = 1
  }

  const { count } = await sb.from('lancamento').select('*', { count: 'exact', head: true }).eq('tipo', tipo)
  console.log(`\ncriados ............... ${criados}`)
  console.log(`lançamentos de ${tipo} ..  ${count}`)
}
