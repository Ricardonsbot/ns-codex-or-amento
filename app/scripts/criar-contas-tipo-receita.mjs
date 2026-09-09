/**
 * Cria no plano de contas os tipos de receita que o Template Budget oferece na
 * coluna "Conta Contábil" mas que não existiam como conta.
 *
 * Uso:
 *   cd app
 *   node --env-file=.env scripts/criar-contas-tipo-receita.mjs [--aplicar]
 *
 * Sem --aplicar só mostra o que faria.
 *
 * POR QUE ESTES CÓDIGOS
 *
 * O plano já separa os tipos de receita em duas famílias, e a divisão é a mesma
 * do template: a coluna MRR da aba "Parâmetros Receitas" diz Sim para os
 * recorrentes e Não para os pontuais.
 *
 *   3.1.01.006.NNN  recorrente   001 Software SaaS · 002 Software On Premise
 *                                003 BPO + Software · 004 Mão de Obra BPO
 *                                005 Cloud / Infra de Tecnologia
 *   3.1.01.007.NNN  pontual      001 Implantação · 003 Customização
 *                                004 Treinamento · 005 Suporte / Sustentação
 *
 * Daí sai cada código abaixo. O de "Outras receitas" não é escolha: a
 * sub-conta de reversão já existe em 3.1.01.007.006.0002, então a conta-base
 * dela só pode ser 3.1.01.007.006.
 *
 * Os nomes vão em maiúsculas e sem acento, como todo o resto do plano. O
 * casamento na importação ignora caixa e acento, então "CS dedicado" da
 * planilha encontra "CS DEDICADO" aqui.
 */
import { createClient } from '@supabase/supabase-js'

const LINHA_PL = 'Receita > Gross Revenue'
const CATEGORIA = 'Gross Revenue'

const NOVAS = [
  { codigo: '3.1.01.006.006', nome: 'SQUAD DEDICADA', de: 'Squad dedicada', mrr: 'recorrente' },
  { codigo: '3.1.01.006.007', nome: 'CS DEDICADO', de: 'CS dedicado', mrr: 'recorrente' },
  { codigo: '3.1.01.007.006', nome: 'OUTRAS RECEITAS', de: 'Outras receitas', mrr: 'pontual' },
  { codigo: '3.1.01.007.007', nome: 'VENDA DE PRODUTO', de: 'Venda de produto', mrr: 'pontual' },
]

const aplicar = process.argv.includes('--aplicar')
const url = process.env.VITE_SUPABASE_URL
const chave = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !chave) {
  console.error('faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — rode com "node --env-file=.env".')
  process.exit(1)
}
const sb = createClient(url, chave)

const contas = []
for (let de = 0; ; de += 1000) {
  const { data, error } = await sb.from('conta').select('codigo, nome').range(de, de + 999)
  if (error) {
    console.error(`erro ao ler o plano: ${error.message}`)
    process.exit(1)
  }
  contas.push(...data)
  if (data.length < 1000) break
}

const porCodigo = new Set(contas.map((c) => c.codigo))
const lim = (v) =>
  String(v).normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
const porNome = new Set(contas.map((c) => lim(c.nome)))

console.log(`plano de contas ....... ${contas.length} contas\n`)

const criar = []
for (const n of NOVAS) {
  const codigoOcupado = porCodigo.has(n.codigo)
  const nomeExiste = porNome.has(lim(n.nome))
  const situacao = codigoOcupado
    ? 'CÓDIGO JÁ EXISTE — pulando'
    : nomeExiste
    ? 'nome já existe no plano — pulando'
    : 'criar'
  console.log(`  ${n.codigo}  ${n.nome.padEnd(18)} (${n.mrr})  de "${n.de}"  ->  ${situacao}`)
  if (situacao === 'criar') criar.push(n)
}

if (!criar.length) {
  console.log('\nnada a fazer.')
} else if (!aplicar) {
  console.log(`\n--dry-run: ${criar.length} conta(s) seriam criadas. Rode com --aplicar.`)
} else {
  const { data, error } = await sb
    .from('conta')
    .insert(criar.map((n) => ({ codigo: n.codigo, nome: n.nome, linha_pl: LINHA_PL, categoria: CATEGORIA })))
    .select('codigo, nome')
  if (error) {
    console.error(`\nerro ao criar: ${error.message}`)
    process.exitCode = 1
  } else {
    console.log(`\ncriadas ............... ${data.length}`)
    const { count } = await sb.from('conta').select('*', { count: 'exact', head: true })
    console.log(`plano de contas agora   ${count} contas`)
  }
}
