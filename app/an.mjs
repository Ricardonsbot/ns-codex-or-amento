import * as XLSX from 'xlsx'
import fs from 'node:fs'
const wb = XLSX.read(fs.readFileSync(process.argv[2]), { type: 'buffer', dense: true, sheets: ['Mapa Empresas', 'Mapa CentroCusto'] })

// ---------- empresas
{
  const aba = wb.Sheets['Mapa Empresas']; const r = XLSX.utils.decode_range(aba['!ref']); const d = aba['!data']
  const v = (l, c) => { const x = d[l - 1]?.[c]?.v; return x == null ? '' : String(x).trim() }
  const rows = []
  for (let l = 3; l <= r.e.r + 1; l++) {
    const [bu, torre, sub, agrup, antes, dep] = [2,3,4,5,6,7].map((c) => v(l, c))
    if (!bu || !dep) continue
    rows.push({ bu, torre, sub, agrup, antes, empresa: dep })
  }
  console.log('EMPRESAS no mapa:', rows.length)
  console.log('  BUs:', [...new Set(rows.map(x => x.bu))].join(' | '))
  console.log('  torres:', [...new Set(rows.map(x => x.torre))].length, [...new Set(rows.map(x => x.torre))].join(' | '))
  console.log('  subtorres:', [...new Set(rows.map(x => x.sub))].length)
  const nomes = [...new Set(rows.map(x => x.empresa))]
  console.log('  empresas distintas:', nomes.length)
  const dup = rows.filter((x, i) => rows.findIndex(y => y.empresa === x.empresa) !== i)
  const conflito = dup.filter(x => { const p = rows.find(y => y.empresa === x.empresa); return p.torre !== x.torre || p.sub !== x.sub || p.bu !== x.bu })
  console.log('  repetidas com hierarquia diferente:', conflito.length, conflito.slice(0,5).map(x=>x.empresa))
  fs.writeFileSync('C:/Users/RICARD~1/AppData/Local/Temp/claude/C--Users-RicardoMassafelliBat-OneDrive---NSTECH-GR-LTDA--rea-de-Trabalho-Ferramenta-Or-ament-ria/a5775707-ccea-405d-9f26-a638b52a5062/scratchpad/empresas.json', JSON.stringify(nomes))
}
// ---------- centros de custo
{
  const aba = wb.Sheets['Mapa CentroCusto']; const r = XLSX.utils.decode_range(aba['!ref']); const d = aba['!data']
  const v = (l, c) => { const x = d[l - 1]?.[c]?.v; return x == null ? '' : String(x).trim() }
  const m = new Map(); let semCod = 0; const conflitos = []
  for (let l = 3; l <= r.e.r + 1; l++) {
    const cod = v(l, 4), nome = v(l, 5), emp = v(l, 6), dir = v(l, 8), empFim = v(l, 2)
    if (!cod && !nome) continue
    if (!cod) { semCod++; continue }
    const ja = m.get(cod)
    if (ja && ja.nome !== nome) conflitos.push([cod, ja.nome, nome])
    if (!ja) m.set(cod, { cod, nome, emp, dir, empFim })
  }
  console.log('\nCENTROS DE CUSTO no mapa:', m.size, '| linhas sem código:', semCod, '| mesmo código com nome diferente:', conflitos.length)
  console.log('  exemplos:', [...m.values()].slice(0, 3))
  console.log('  conflitos:', conflitos.slice(0, 3))
  const dirs = new Set([...m.values()].map(x => x.dir).filter(x => x && x !== 'NA'))
  console.log('  diretorias:', dirs.size, [...dirs].slice(0, 10))
  const emps = new Set([...m.values()].map(x => x.emp).filter(Boolean))
  console.log('  empresas citadas:', emps.size)
  fs.writeFileSync('C:/Users/RICARD~1/AppData/Local/Temp/claude/C--Users-RicardoMassafelliBat-OneDrive---NSTECH-GR-LTDA--rea-de-Trabalho-Ferramenta-Or-ament-ria/a5775707-ccea-405d-9f26-a638b52a5062/scratchpad/cc.json', JSON.stringify([...m.values()]))
}
