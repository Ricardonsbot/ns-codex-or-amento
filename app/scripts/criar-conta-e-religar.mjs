/**
 * Cria uma conta no plano e religa os lançamentos que estavam marcados como
 * "conta não existe".
 *
 * Criar a conta sozinha não resolve: os lançamentos já gravados ficaram com
 * `conta_id` nulo e continuariam fora do P&L. Este script fecha o ciclo — cria
 * a conta, acha as linhas marcadas com aquele código no `obs` e aponta as duas
 * pontas, tirando o aviso que deixou de ser verdade.
 *
 * O código é gravado no formato pontuado do plano (4.7.03.002.097). O
 * casamento com o template é por dígitos, então os dois formatos funcionam,
 * mas a maioria das contas usa ponto e misturar atrapalha quem lê a lista.
 *
 * Uso:
 *   cd app
 *   node --env-file=.env scripts/criar-conta-e-religar.mjs <codigo> "<nome>" "<linha_pl>" "<categoria>" "<motivo>"
 *   ... --aplicar
 */
import { createClient } from '@supabase/supabase-js'

const [codigo, nome, linhaPl, categoria, motivo] = process.argv.slice(2)
const aplicar = process.argv.includes('--aplicar')
if (!codigo || !nome || !linhaPl) {
  console.error('uso: node --env-file=.env scripts/criar-conta-e-religar.mjs <codigo> "<nome>" "<linha_pl>" "<categoria>" "<motivo>" [--aplicar]')
  throw new Error('argumentos faltando')
}

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const soDigitos = (v) => String(v ?? '').replace(/\D/g, '')
const digitos = soDigitos(codigo)

// ---- a conta já existe? ----------------------------------------------------
const { data: todas, error: e1 } = await sb.from('conta').select('id, codigo, nome, linha_pl')
if (e1) throw new Error(e1.message)
const existente = todas.find((c) => soDigitos(c.codigo) === digitos)

// ---- quais lançamentos estão esperando por ela -----------------------------
const orfaos = []
for (let de = 0; ; de += 1000) {
  const { data, error } = await sb
    .from('lancamento')
    .select('id, tipo, obs, empresa:empresa_id(nome), lancamento_valor_mensal(valor)')
    .is('conta_id', null)
    .range(de, de + 999)
  if (error) throw new Error(error.message)
  orfaos.push(...data)
  if (data.length < 1000) break
}
const alvo = orfaos.filter((l) => soDigitos((/Conta\s+([\d.]+)/.exec(l.obs ?? '') ?? [])[1]) === digitos)

const total = (l) => (l.lancamento_valor_mensal ?? []).reduce((a, x) => a + Number(x.valor), 0)
console.log(`conta ................. ${codigo}  ${nome}`)
console.log(`linha do P&L .......... ${linhaPl}`)
console.log(`categoria ............. ${categoria || '—'}`)
console.log(`já existe no plano .... ${existente ? `SIM (${existente.codigo})` : 'não'}`)
console.log(`\nlançamentos a religar:  ${alvo.length}`)
for (const l of alvo) {
  console.log(`   ${(l.empresa?.nome ?? '—').padEnd(10)} ${l.tipo.padEnd(8)} R$ ${(total(l) / 1e6).toFixed(3).padStart(8)} mi`)
}
console.log(`   soma ................ R$ ${(alvo.reduce((a, l) => a + total(l), 0) / 1e6).toFixed(3)} mi`)

if (!aplicar) {
  console.log('\nsem --aplicar: nada foi criado nem alterado.')
} else {
  let contaId = existente?.id
  if (!contaId) {
    const { data, error } = await sb
      .from('conta')
      .insert({ codigo, nome, linha_pl: linhaPl, categoria: categoria || null, criada_em: new Date().toISOString(), motivo: motivo || null })
      .select('id, codigo')
    if (error) throw new Error(`criando a conta: ${error.message}`)
    contaId = data[0].id
    console.log(`\nconta criada: ${data[0].codigo}`)
  } else {
    console.log('\nconta já existia; só religando os lançamentos.')
  }

  let religados = 0
  for (const l of alvo) {
    // O aviso do obs deixou de ser verdade: sai o trecho marcado, fica o resto.
    const limpo = (l.obs ?? '')
      .split(' | ')
      .filter((p) => !p.startsWith('⚠'))
      .join(' | ')
    const { error } = await sb
      .from('lancamento')
      .update({ conta_id: contaId, obs: limpo || null })
      .eq('id', l.id)
    if (error) throw new Error(`religando ${l.id}: ${error.message}`)
    religados += 1
  }
  console.log(`religados ............. ${religados}`)
}
