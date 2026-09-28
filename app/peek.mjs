import * as XLSX from 'xlsx'
import fs from 'node:fs'
const [file, sheet, n0, n1, maxc] = process.argv.slice(2)
const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer', dense: true, sheets: [sheet] })
const aba = wb.Sheets[sheet]
if (!aba) { console.log('SEM ABA ' + sheet); process.exit(0) }
const r = XLSX.utils.decode_range(aba['!ref']); const d = aba['!data']
console.log(`--- ${sheet}  range ${aba['!ref']}`)
for (let l = Number(n0); l <= Number(n1); l++) {
  const cells = []
  for (let c = r.s.c; c <= Math.min(r.e.c, r.s.c + Number(maxc || 10)); c++) {
    const v = d[l - 1]?.[c]?.v
    if (v == null || v === '') continue
    cells.push(`${XLSX.utils.encode_col(c)}=${String(v).slice(0, 40)}`)
  }
  if (cells.length) console.log(`L${l}: ` + cells.join(' | '))
}
