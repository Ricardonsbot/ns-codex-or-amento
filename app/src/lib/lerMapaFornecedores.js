import * as XLSX from 'xlsx'
import { lim } from './lerTemplateOrcamento'

/**
 * Os cadastros que o Template Budget 2027 passou a carregar dentro dele.
 *
 * A aba "Mapa Fornecedores" é a lista oficial de pacote, subpacote e
 * agrupamento de fornecedor — o que antes era digitado à mão em Cadastros e
 * por isso vivia desencontrado do que vinha na Base Gastos. A aba "ERP", que
 * o mesmo arquivo traz, tem o CNPJ de cada fornecedor por código de pessoa;
 * é opcional, e sem ela o fornecedor entra só com o nome.
 *
 * Nada aqui grava: esta leitura só devolve o que o arquivo tem, para a tela
 * mostrar antes e a carga decidir o que falta.
 */

/**
 * Marcadores de trabalho pendente do mapa. Aparecem tanto na coluna de pacote
 * quanto na de grupo, e querem dizer "ainda não classificado" — não são nome
 * de pacote nem de grupo, e cadastrá-los daria lista oficial a uma pendência.
 */
export const MARCADORES = ['REFINAR', 'CADASTRAR']

/** Se este nome é um marcador de pendência, e não um cadastro de verdade. */
export const ehMarcador = (nome) => MARCADORES.includes(lim(nome))

const ABA_MAPA = 'Mapa Fornecedores'
const ABA_ERP = 'ERP'

/** A linha de cabeçalho da aba, achada pela célula "Pacote". */
function acharCabecalho(bruto, r) {
  for (let l = r.s.r + 1; l <= Math.min(r.e.r + 1, r.s.r + 20); l++) {
    for (let c = r.s.c; c <= r.e.c; c++) {
      const v = bruto(l, c)?.v
      if (typeof v === 'string' && lim(v) === 'PACOTE') return l
    }
  }
  return -1
}

/**
 * Se o arquivo tem a aba de cadastros, sem parsear nenhuma delas — é o que
 * decide mostrar ou não o card de carga.
 */
export function temMapaDeFornecedores(arrayBuffer) {
  const nomes = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', bookSheets: true }).SheetNames ?? []
  return nomes.some((n) => lim(n) === lim(ABA_MAPA))
}

export function lerCadastrosDoTemplate(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), {
    type: 'array',
    dense: true,
    sheets: [ABA_MAPA, ABA_ERP],
  })
  const aba = wb.Sheets[ABA_MAPA]
  if (!aba) throw new Error(`Este arquivo não tem a aba "${ABA_MAPA}" — é de um template anterior ao 2027.`)

  const r = XLSX.utils.decode_range(aba['!ref'])
  const d = aba['!data']
  const bruto = (l, c) => d[l - 1]?.[c]
  const txt = (l, c) => {
    const v = bruto(l, c)?.v
    return v == null ? '' : String(v).split(/\s+/).filter(Boolean).join(' ')
  }

  const cab = acharCabecalho(bruto, r)
  if (cab === -1) throw new Error(`Não encontrei a coluna "Pacote" na aba "${ABA_MAPA}".`)

  const col = {}
  for (let c = r.s.c; c <= r.e.c; c++) {
    const k = lim(txt(cab, c))
    if (k && col[k] === undefined) col[k] = c
  }
  const need = ['PACOTE', 'SUBPACOTE']
  const faltando = need.filter((k) => col[k] === undefined)
  if (faltando.length) throw new Error(`A aba "${ABA_MAPA}" está sem as colunas: ${faltando.join(', ')}.`)
  const cGrupo = col['GRUPO FORNECEDOR III'] ?? col['GRUPO FORNECEDOR'] ?? null
  const cCod = col['COD PESSOA'] ?? null
  const cRazao = col['RAZAO SOCIAL'] ?? null
  const cForn = col.FORNECEDOR ?? cRazao

  // CNPJ por código de pessoa, da aba ERP. O mesmo código aparece uma vez por
  // empresa-base; o primeiro basta, o CNPJ é do fornecedor, não da empresa.
  const cnpjPorCodigo = new Map()
  const erp = wb.Sheets[ABA_ERP]
  if (erp) {
    const re = XLSX.utils.decode_range(erp['!ref'])
    const de = erp['!data']
    const cabE = (() => {
      for (let l = re.s.r + 1; l <= Math.min(re.e.r + 1, re.s.r + 10); l++)
        for (let c = re.s.c; c <= re.e.c; c++) {
          const v = de[l - 1]?.[c]?.v
          if (typeof v === 'string' && lim(v) === 'COD PESSOA') return l
        }
      return -1
    })()
    if (cabE !== -1) {
      const colE = {}
      for (let c = re.s.c; c <= re.e.c; c++) {
        const v = de[cabE - 1]?.[c]?.v
        const k = typeof v === 'string' ? lim(v) : ''
        if (k && colE[k] === undefined) colE[k] = c
      }
      const cc = colE['COD PESSOA']
      const cd = colE['CNPJ CPF']
      if (cc !== undefined && cd !== undefined) {
        for (let l = cabE + 1; l <= re.e.r + 1; l++) {
          const cod = de[l - 1]?.[cc]?.v
          const doc = de[l - 1]?.[cd]?.v
          if (cod == null || !doc) continue
          const chave = String(cod).trim()
          if (!cnpjPorCodigo.has(chave)) cnpjPorCodigo.set(chave, String(doc).trim())
        }
      }
    }
  }

  const pacotes = new Map()
  const subpacotes = new Map()
  const grupos = new Map()
  const fornecedores = new Map()
  let linhas = 0

  for (let l = cab + 1; l <= r.e.r + 1; l++) {
    const pacote = txt(l, col.PACOTE).trim()
    const subpacote = txt(l, col.SUBPACOTE).trim()
    const grupo = cGrupo === null ? '' : txt(l, cGrupo).trim()
    const razao = cRazao === null ? '' : txt(l, cRazao).trim()
    // A coluna Fornecedor às vezes vem truncada a um caractere ou a um número
    // solto ("0"), e aí a razão social é o único nome utilizável.
    const curto = cForn === null ? '' : txt(l, cForn).trim()
    const nome = curto.replace(/[^\p{L}]/gu, '').length >= 3 ? curto : razao || curto
    if (!pacote && !subpacote && !grupo && !nome) continue
    linhas += 1

    if (pacote) pacotes.set(pacote, (pacotes.get(pacote) ?? 0) + 1)
    if (pacote && subpacote) subpacotes.set(`${pacote}\u0000${subpacote}`, { pacote, nome: subpacote })
    if (grupo) grupos.set(grupo, (grupos.get(grupo) ?? 0) + 1)
    if (nome && !fornecedores.has(nome)) {
      const cod = cCod === null ? '' : txt(l, cCod).trim()
      fornecedores.set(nome, {
        nome,
        razao,
        grupo,
        codigo: cod,
        documento: cnpjPorCodigo.get(cod) ?? '',
      })
    }
  }

  const ordena = (a, b) => a.localeCompare(b, 'pt-BR')
  return {
    linhas,
    temErp: cnpjPorCodigo.size > 0,
    pacotes: [...pacotes.keys()].sort(ordena),
    subpacotes: [...subpacotes.values()].sort((a, b) => ordena(a.pacote + a.nome, b.pacote + b.nome)),
    grupos: [...grupos.keys()].sort(ordena),
    fornecedores: [...fornecedores.values()].sort((a, b) => ordena(a.nome, b.nome)),
  }
}

/** Quais nomes desta lista são marcador de pendência. */
export function marcadores(nomes) {
  return nomes.filter(ehMarcador)
}
