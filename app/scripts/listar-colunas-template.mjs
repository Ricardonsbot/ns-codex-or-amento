/**
 * Lista todas as colunas de cada aba do Template Budget, com uma amostra do
 * conteúdo e o que a ferramenta faz com elas hoje.
 *
 * Serve para desenhar o schema: sem isso o que se guarda no banco é o que
 * alguém lembrou de mapear, e o resto vira texto em `obs` ou se perde.
 *
 * Uso:
 *   cd app
 *   node scripts/listar-colunas-template.mjs "<Template .xlsb>"
 */
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { TEMPLATE } from '../src/lib/lerTemplateOrcamento.js'

const caminho = process.argv[2]
if (!caminho) {
  console.error('uso: node scripts/listar-colunas-template.mjs "<Template .xlsb>"')
  process.exit(1)
}

const buf = readFileSync(caminho)
const wb = XLSX.read(buf, { dense: true })

/** O mesmo normalizador do leitor: sem acento, maiúsculo, só letras e dígitos. */
const chave = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()

for (const [tipo, cfg] of Object.entries(TEMPLATE)) {
  const ws = wb.Sheets[cfg.aba]
  if (!ws) {
    console.log(`\n### ${cfg.aba}: aba não existe neste arquivo`)
    continue
  }
  const range = XLSX.utils.decode_range(ws['!ref'])

  // Acha a linha do cabeçalho pela âncora, como o leitor faz.
  let linhaCab = -1
  for (let r = range.s.r; r <= Math.min(range.s.r + 20, range.e.r); r++) {
    const row = ws['!data']?.[r] ?? []
    if (row.some((c) => chave(c?.v) === cfg.ancora)) {
      linhaCab = r
      break
    }
  }
  if (linhaCab < 0) {
    console.log(`\n### ${cfg.aba}: não achei a âncora "${cfg.ancora}"`)
    continue
  }

  const cab = ws['!data'][linhaCab] ?? []
  const titulos = ws['!data'][1] ?? [] // linha 2: título do bloco de meses

  console.log(`\n### ${cfg.aba}  (cabeçalho na linha ${linhaCab + 1})`)
  console.log('col  rótulo                                    bloco (linha 2)      amostra')

  for (let c = range.s.c; c <= range.e.c; c++) {
    const rot = String(cab[c]?.v ?? '').trim()
    if (!rot) continue
    const bloco = String(titulos[c]?.v ?? '').trim()
    // Primeiro valor não vazio abaixo do cabeçalho.
    let amostra = ''
    for (let r = linhaCab + 1; r <= Math.min(linhaCab + 40, range.e.r); r++) {
      const v = ws['!data']?.[r]?.[c]?.v
      if (v !== undefined && v !== null && String(v).trim() !== '' && String(v) !== '0') {
        amostra = String(v).slice(0, 28)
        break
      }
    }
    console.log(
      `${XLSX.utils.encode_col(c).padEnd(4)} ${rot.slice(0, 40).padEnd(40)} ${bloco.slice(0, 20).padEnd(20)} ${amostra}`
    )
  }
}
