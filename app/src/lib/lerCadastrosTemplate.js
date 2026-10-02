import * as XLSX from 'xlsx'
import { lim } from './lerTemplateOrcamento'

/**
 * Os cadastros que o Template Budget 2027 passou a carregar dentro dele.
 *
 * São quatro mapas, e todos descrevem o que a Base Gastos usa nas colunas:
 *
 *   Mapa Fornecedores .. pacote, subpacote e agrupamento de fornecedor
 *   ERP ................ o CNPJ de cada fornecedor, por código de pessoa
 *   Mapa CentroCusto ... centro de custo por código, com empresa e diretoria
 *   Mapa Empresas ...... a hierarquia BU / torre / subtorre de cada empresa
 *
 * Até aqui isso era digitado à mão em Cadastros e vivia desencontrado do que
 * chegava no template — que é o que faz o checklist acusar "fora do
 * cadastro". Cada mapa é opcional: um arquivo antigo simplesmente não traz
 * aquela parte.
 *
 * O Mapa Empresas ficou indispensável de outra forma: no template 2027 a
 * coluna Torre saiu das linhas, então a hierarquia só existe ali.
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
const ABA_CC = 'Mapa CentroCusto'
const ABA_EMPRESAS = 'Mapa Empresas'
const ABAS = [ABA_MAPA, ABA_ERP, ABA_CC, ABA_EMPRESAS]

/** Um leitor de células para a aba, no formato denso. */
function leitor(aba) {
  const r = XLSX.utils.decode_range(aba['!ref'])
  const d = aba['!data']
  const bruto = (l, c) => d[l - 1]?.[c]
  const txt = (l, c) => {
    const v = bruto(l, c)?.v
    return v == null ? '' : String(v).split(/\s+/).filter(Boolean).join(' ')
  }
  return { r, bruto, txt }
}

/**
 * A linha de cabeçalho e as colunas da aba, achadas por um rótulo âncora.
 * Devolve null quando a âncora não aparece — aba de outro formato, que é
 * melhor ignorar do que ler torto.
 */
function cabecalho(aba, ancora, limite = 20) {
  const { r, txt } = leitor(aba)
  for (let l = r.s.r + 1; l <= Math.min(r.e.r + 1, r.s.r + limite); l++) {
    for (let c = r.s.c; c <= r.e.c; c++) {
      if (lim(txt(l, c)) !== ancora) continue
      const col = {}
      for (let x = r.s.c; x <= r.e.c; x++) {
        const k = lim(txt(l, x))
        if (k && col[k] === undefined) col[k] = x
      }
      return { linha: l, col }
    }
  }
  return null
}

/**
 * Centros de custo do "Mapa CentroCusto": código, o caminho completo como
 * nome, e de que empresa e diretoria ele é.
 *
 * O mesmo código aparece em várias linhas, e às vezes com nomes diferentes —
 * ele é único dentro da empresa, não no grupo. Vale o primeiro, e os
 * divergentes são contados para a tela poder dizer quantos são.
 */
function lerCentrosDeCusto(wb) {
  const vazio = { centros: [], diretorias: [], conflitos: 0 }
  const aba = wb.Sheets[ABA_CC]
  if (!aba) return vazio
  const achado = cabecalho(aba, 'ORGANIZACIONAL CODIGO')
  if (!achado) return vazio

  const { r, txt } = leitor(aba)
  const { linha, col } = achado
  const cCod = col['ORGANIZACIONAL CODIGO']
  const cNome = col.ORGANIZACIONAL
  const cEmp = col['EMPRESA TEMPLATE BGT'] ?? col['EMPRESA FIM']
  const cDir = col.DIRETORIA

  const centros = new Map()
  const dirs = new Set()
  let conflitos = 0
  for (let l = linha + 1; l <= r.e.r + 1; l++) {
    const codigo = txt(l, cCod).trim()
    if (!codigo) continue
    const nome = cNome === undefined ? '' : txt(l, cNome).trim()
    const diretoria = cDir === undefined ? '' : txt(l, cDir).trim()
    // "NA" é como o mapa escreve "não se aplica": não é nome de diretoria.
    const temDir = diretoria && lim(diretoria) !== 'NA'
    if (temDir) dirs.add(diretoria)
    const ja = centros.get(codigo)
    if (ja) {
      if (nome && ja.nome && nome !== ja.nome) conflitos += 1
      continue
    }
    centros.set(codigo, {
      codigo,
      nome: nome || codigo,
      empresa: cEmp === undefined ? '' : txt(l, cEmp).trim(),
      diretoria: temDir ? diretoria : '',
    })
  }
  const ordena = (a, b) => a.localeCompare(b, 'pt-BR')
  return {
    centros: [...centros.values()].sort((a, b) => ordena(a.codigo, b.codigo)),
    diretorias: [...dirs].sort(ordena),
    conflitos,
  }
}

/**
 * A hierarquia do "Mapa Empresas": BU, torre e subtorre de cada empresa.
 *
 * O nome que vale é o da coluna "Empresa Depois" — é o que a Base Gastos
 * escreve na coluna Empresa. "Empresa Gerencial Antes" é o nome anterior, e
 * serve para reconhecer quem já está cadastrado com o nome velho.
 */
function lerEmpresas(wb) {
  const aba = wb.Sheets[ABA_EMPRESAS]
  if (!aba) return []
  const achado = cabecalho(aba, 'SUBTORRE')
  if (!achado) return []

  const { r, txt } = leitor(aba)
  const { linha, col } = achado
  // "Empresa Depois" na v1 do template 2027, "Empresa" na definitiva.
  const cEmpresa = col['EMPRESA DEPOIS'] ?? col.EMPRESA
  if (cEmpresa === undefined) return []

  const mapa = new Map()
  for (let l = linha + 1; l <= r.e.r + 1; l++) {
    const nome = txt(l, cEmpresa).trim()
    const bu = col.BU === undefined ? '' : txt(l, col.BU).trim()
    // Sem BU a linha é resto de filtro da planilha ("Todas"), não empresa.
    if (!nome || !bu || mapa.has(nome)) continue
    const antes = col['EMPRESA GERENCIAL ANTES']
    mapa.set(nome, {
      nome,
      bu,
      torre: col.TORRE === undefined ? '' : txt(l, col.TORRE).trim(),
      subtorre: txt(l, col.SUBTORRE).trim(),
      antes: antes === undefined ? '' : txt(l, antes).trim(),
    })
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

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
 * Se o arquivo traz algum dos mapas de cadastro, sem parsear nenhum deles —
 * é o que decide mostrar ou não o card de carga.
 */
export function temMapasDeCadastro(arrayBuffer) {
  const nomes = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', bookSheets: true }).SheetNames ?? []
  const quero = new Set([ABA_MAPA, ABA_CC, ABA_EMPRESAS].map(lim))
  return nomes.some((n) => quero.has(lim(n)))
}

export function lerCadastrosDoTemplate(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', dense: true, sheets: ABAS })
  const { centros, diretorias, conflitos } = lerCentrosDeCusto(wb)
  const empresas = lerEmpresas(wb)
  const outrosMapas = { centrosDeCusto: centros, diretorias, conflitosDeCentro: conflitos, empresas }

  const aba = wb.Sheets[ABA_MAPA]
  if (!aba) {
    // Sem o mapa de fornecedores ainda pode haver os outros dois; só não há
    // pacote, subpacote nem fornecedor para carregar.
    if (!centros.length && !empresas.length) {
      throw new Error('Este arquivo não traz nenhum mapa de cadastro — é de um template anterior ao 2027.')
    }
    return { linhas: 0, temErp: false, pacotes: [], subpacotes: [], grupos: [], fornecedores: [], ...outrosMapas }
  }

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
    ...outrosMapas,
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
