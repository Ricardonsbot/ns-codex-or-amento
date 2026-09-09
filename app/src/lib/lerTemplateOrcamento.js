import * as XLSX from 'xlsx'

/**
 * Leitura das abas de lançamento do Template Budget, para importação pela tela.
 *
 * As três abas têm o mesmo esqueleto: uma faixa de colunas de dimensão seguida
 * de blocos de 12 meses. O que muda é o nome da aba, o nome das colunas e
 * quantos blocos de mês vêm depois. Entra sempre o PRIMEIRO bloco:
 *
 *   Receita ...... bruta digitada  (depois vêm proporção, reajuste, deduções,
 *                  líquida — a dedução é linha própria do P&L e a ferramenta já
 *                  guarda as alíquotas, então gravar a líquida perderia a
 *                  dedução pelo caminho)
 *   Base Gastos .. competência     (depois vem o bloco de caixa)
 *   Capex ........ competência     (depois vem o bloco de caixa)
 *
 * Colunas são localizadas pelo texto do cabeçalho, nunca por índice: as abas
 * desta pasta começam fora da coluna A, e o SheetJS indexa a partir do início
 * do intervalo — índice fixo aponta para a coluna errada sem dar erro.
 */

const semAcento = (v) => String(v).normalize('NFD').replace(/\p{Diacritic}/gu, '')
export const lim = (v) => semAcento(v).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

const junta = (...partes) => partes.filter(Boolean).join(' · ')

/**
 * Se a célula tem conteúdo de verdade. Zero não conta: as abas do template
 * arrastam fórmula por milhares de linhas vazias, e elas devolvem 0 — que como
 * texto vira "0" e passaria por preenchido.
 */
const util = (v) => String(v ?? '').replace(/[\s0.,-]/g, '') !== ''

/**
 * `ancora` é a célula que identifica a linha de cabeçalho. `exigidas` são as
 * colunas sem as quais a aba não é reconhecível — se faltarem, é melhor falhar
 * do que ler a planilha errada em silêncio.
 *
 * `sinal` converte a convenção da planilha para a do banco: o template escreve
 * gasto e capex como número negativo, e a ferramenta guarda a magnitude
 * (`ebitda = receita - despesa`). É negação, e não valor absoluto, para que um
 * crédito lançado no meio dos gastos continue reduzindo a despesa.
 */
export const TEMPLATE = {
  receita: {
    aba: 'Receita',
    ancora: 'TIPO RECEITA',
    exigidas: ['TIPO RECEITA', 'CONTA CONTABIL', 'EMPRESA', 'PRODUTO ANALITICO'],
    colEmpresa: 'EMPRESA',
    sinal: 1,
    // Título do bloco (linha 2) cujos meses entram como valor do lançamento.
    bloco: 'VALORES BASE',
    // Blocos que o template calcula a partir da base. O nome à esquerda é a
    // coluna de lancamento_valor_mensal que recebe cada um.
    derivados: [
      ['proporcao', 'PROPORCAO DE REAJUSTE'],
      ['valor_ajustado', 'VALORES REAJUSTADOS'],
      ['valor_liquido', 'RECEITA LIQUIDA'],
    ],
    // Valor único da linha, achado pelo rótulo da linha 3.
    aliquotaRotulo: 'ALIQUOTAS',
    // Demais colunas da linha, capturadas para não se perderem. O rótulo é o
    // texto do cabeçalho; o nome é como aparece nas observações.
    extras: [
      ['MRR', 'MRR'],
      ['SKU', 'SKU'],
      ['CNPJ', 'CNPJ'],
      ['PERSONA', 'Persona'],
      ['SEGMENTO SINTETICO', 'Segmento sintético'],
      ['SEGMENTO ANALITICO', 'Segmento analítico'],
      ['CLASSE DE CLIENTES', 'Classe'],
      ['PMR', 'PMR'],
      ['TERMOMETRO DE VENDAS', 'Termômetro'],
      ['PROJETO', 'Projeto'],
      ['MES REAJUSTE', 'Mês de reajuste'],
      ['INDICE PROJETADO', 'Índice'],
      ['TAXA DE SUCESSO', 'Taxa de sucesso'],
      ['TAXA EFETIVA', 'Taxa efetiva'],
      ['PROPORCAO MANUAL', 'Proporção manual'],
    ],
    monta: (t) => ({
      contaCodigo: '',
      contaRotulo: t('CONTA CONTABIL'),
      // A aba Receita não tem "Alocação PnL (Área)": receita é Net Revenue.
      area: '',
      descricao: junta(t('PRODUTO ANALITICO') || t('PRODUTO SINTETICO'), t('TIPO RECEITA')),
      centroCusto: '',
      fornecedor: '',
      obs: [t('RAZAO SOCIAL CLIENTE') && `Cliente: ${t('RAZAO SOCIAL CLIENTE')}`, t('OBS')]
        .filter(Boolean)
        .join(' | '),
    }),
  },
  despesa: {
    aba: 'Base Gastos',
    ancora: 'NUMERO DA CONTA',
    exigidas: ['NUMERO DA CONTA', 'NOME DA CONTA CONTABIL', 'EMPRESA'],
    colEmpresa: 'EMPRESA',
    sinal: -1,
    bloco: 'GASTOS COMPETENCIA',
    derivados: [['valor_caixa', 'GASTOS CAIXA']],
    extras: [
      ['LINHA P L', 'Linha P&L'],
      ['GRUPO CAIXA', 'Grupo caixa'],
      ['DIRETORIA', 'Diretoria'],
      ['TORRE', 'Torre'],
      ['PRODUTO SINTETICO', 'Produto sintético'],
      ['RAZAO SOCIAL CLIENTE', 'Cliente'],
      ['CNPJ', 'CNPJ'],
      ['PERSONA', 'Persona'],
      ['SEGMENTO ANALITICO', 'Segmento analítico'],
      ['CLASSE DE CLIENTES', 'Classe'],
      ['FLAG INTERCOMPANY', 'Intercompany'],
      ['SUBCONTA TECNOLOGIA TERCEIROS', 'Subconta'],
    ],
    monta: (t) => ({
      contaCodigo: t('NUMERO DA CONTA'),
      contaRotulo: t('NOME DA CONTA CONTABIL'),
      area: t('ALOCACAO PNL AREA'),
      descricao: junta(t('DETALHAMENTO'), t('SUBPACOTE')),
      centroCusto: junta(t('CENTRO DE CUSTO'), t('NOME CENTRO DE CUSTO')),
      fornecedor: t('FORNECEDOR'),
      obs: [
        t('PACOTE') && `Pacote: ${t('PACOTE')}`,
        t('PRODUTO ANALITICO') && `Produto: ${t('PRODUTO ANALITICO')}`,
      ]
        .filter(Boolean)
        .join(' | '),
    }),
  },
  capex: {
    aba: 'Capex',
    ancora: 'NUMERO DA CONTA',
    exigidas: ['NUMERO DA CONTA', 'NOME DA CONTA CONTABIL', 'EMPRESA'],
    colEmpresa: 'EMPRESA',
    sinal: -1,
    bloco: 'CAPEX COMPETENCIA',
    derivados: [['valor_caixa', 'CAPEX CAIXA']],
    extras: [
      ['LINHA P L', 'Linha P&L'],
      ['GRUPO CAIXA', 'Grupo caixa'],
      ['DIRETORIA', 'Diretoria'],
      ['TORRE', 'Torre'],
      ['PRODUTO SINTETICO', 'Produto sintético'],
      ['PRODUTO ANALITICO', 'Produto analítico'],
      ['RAZAO SOCIAL CLIENTE', 'Cliente'],
      ['FLAG INTERCOMPANY', 'Intercompany'],
      ['SUBCONTA TECNOLOGIA TERCEIROS', 'Subconta'],
    ],
    monta: (t) => ({
      contaCodigo: t('NUMERO DA CONTA'),
      contaRotulo: t('NOME DA CONTA CONTABIL'),
      area: t('ALOCACAO PNL AREA') || 'Capex',
      descricao: junta(t('ITEM'), t('DESCRICAO')),
      centroCusto: junta(t('CENTRO DE CUSTO'), t('NOME CENTRO DE CUSTO')),
      fornecedor: t('FORNECEDOR'),
      obs: [
        t('QUANT') && `Qtd: ${t('QUANT')}`,
        t('VALOR UNITARIO') && `Unitário: ${t('VALOR UNITARIO')}`,
        t('DETALHAMENTO'),
      ]
        .filter(Boolean)
        .join(' | '),
    }),
  },
}

/** Serial do Excel para o ano, para conferir contra o ciclo antes de importar. */
function anoDoSerial(serial) {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).getUTCFullYear()
}

const eSerial = (v) => typeof v === 'number' && v > 40000 && v < 60000

/**
 * Como a célula aparece nas observações. Data continua data em vez de virar o
 * serial cru do Excel, e fração de percentual vira percentual: a planilha
 * guarda 0,8 onde mostra 80%.
 */
function paraTexto(v, rotulo) {
  if (eSerial(v)) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000)
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
  }
  if (typeof v === 'number' && /TAXA|PERCENT|PROPORCAO|%/.test(rotulo)) {
    return `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
  }
  return v == null ? '' : String(v).split(/\s+/).filter(Boolean).join(' ')
}

export function lerPlanilha(arrayBuffer, tipo) {
  const cfg = TEMPLATE[tipo]
  if (!cfg) throw new Error(`Tipo "${tipo}" não tem aba mapeada no template.`)

  // `sheets` limita à aba pedida e `dense` guarda a aba como matriz em vez de um
  // objeto com uma chave por célula. São abas de milhares de linhas por ~100
  // colunas: sem isso o SheetJS cria milhões de propriedades para ler meia
  // dúzia de valores.
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', sheets: cfg.aba, dense: true })
  const aba = wb.Sheets[cfg.aba]
  if (!aba) {
    throw new Error(`A planilha não tem a aba "${cfg.aba}". Abas encontradas: ${wb.SheetNames.join(', ')}.`)
  }

  const r = XLSX.utils.decode_range(aba['!ref'])
  // No modo denso a aba vem em `!data`, indexada por [linha][coluna] com base
  // zero; `l` aqui é número de linha da planilha, base um.
  const denso = aba['!data']
  const bruto = denso
    ? (l, c) => denso[l - 1]?.[c]
    : (l, c) => aba[`${XLSX.utils.encode_col(c)}${l}`]
  const texto = (l, c) => {
    const x = bruto(l, c)
    return x?.v == null ? '' : String(x.v).split(/\s+/).filter(Boolean).join(' ')
  }
  const numero = (l, c) => {
    const x = bruto(l, c)
    return typeof x?.v === 'number' ? x.v : null
  }

  let cab = -1
  for (let l = r.s.r + 1; l <= r.e.r + 1 && cab === -1; l++) {
    for (let c = r.s.c; c <= r.e.c; c++) {
      if (lim(texto(l, c)) === cfg.ancora) {
        cab = l
        break
      }
    }
  }
  if (cab === -1) {
    throw new Error(`Não encontrei a linha de cabeçalho na aba "${cfg.aba}" (procurei a célula "${cfg.ancora}").`)
  }

  const col = {}
  for (let c = r.s.c; c <= r.e.c; c++) {
    const k = lim(texto(cab, c))
    if (k && col[k] === undefined) col[k] = c
  }
  const faltando = cfg.exigidas.filter((e) => col[e] === undefined)
  if (faltando.length) throw new Error(`Cabeçalho da aba "${cfg.aba}" sem as colunas: ${faltando.join(', ')}.`)

  // Primeiro bloco de meses: a primeira sequência ININTERRUPTA de datas no
  // cabeçalho, que tem de ter exatamente 12.
  //
  // A regra é estrita de propósito. Antes ela era "a primeira sequência de 12",
  // pulando as incompletas — e aí uma coluna a mais no meio dos meses partia o
  // bloco em 5 + 7, ambos descartados, e o leitor seguia até achar 12 seguidas
  // no bloco de PROPORÇÃO DE REAJUSTE. Importava 0,25 por mês no lugar da
  // receita, sem erro nenhum. Nas quatro abas reais o primeiro bloco tem
  // exatamente 12 datas seguidas, então exigir isso não custa nada e troca uma
  // corrupção silenciosa por uma recusa explicada.
  const corridas = []
  let atual = []
  for (let c = r.s.c; c <= r.e.c; c++) {
    const x = bruto(cab, c)
    if (typeof x?.v === 'number' && x.v > 40000 && x.v < 60000) atual.push(c)
    else if (atual.length) {
      corridas.push(atual)
      atual = []
    }
  }
  if (atual.length) corridas.push(atual)

  if (!corridas.length) {
    throw new Error(`Não achei nenhuma coluna de mês no cabeçalho da aba "${cfg.aba}".`)
  }
  // Os títulos dos blocos ficam duas linhas acima do cabeçalho ("Valores Base",
  // "Valores Reajustados", "Receita Líquida"...). Quando o título esperado
  // existe, ele é a âncora: diz qual dos cinco blocos entra, em vez de depender
  // de ser o primeiro. Sem o título, cai na primeira corrida.
  const temTitulos = cab - 2 >= 1
  /** As 12 colunas do bloco cujo título (linha 2) é `titulo`, ou null. */
  const blocoPorTitulo = (titulo) => {
    if (!temTitulos) return null
    for (let c = r.s.c; c <= r.e.c; c++) {
      if (lim(texto(cab - 2, c)) !== titulo) continue
      const corrida = corridas.find((x) => x[0] === c)
      return corrida && corrida.length === 12 ? corrida : null
    }
    return null
  }

  let primeira = corridas[0]
  if (cfg.bloco && temTitulos) {
    let inicio = -1
    for (let c = r.s.c; c <= r.e.c; c++) {
      if (lim(texto(cab - 2, c)) === cfg.bloco) {
        inicio = c
        break
      }
    }
    if (inicio !== -1) {
      const doTitulo = corridas.find((x) => x[0] === inicio)
      if (!doTitulo) {
        throw new Error(
          `O bloco "${cfg.bloco}" da aba "${cfg.aba}" começa em ` +
            `${XLSX.utils.encode_col(inicio)}, mas ali não há uma sequência de meses.`
        )
      }
      primeira = doTitulo
    }
  }

  // Blocos calculados pelo template. Ausentes não são erro: a aba pode estar
  // numa versão que ainda não os tem, e o lançamento fica sem eles.
  const derivados = (cfg.derivados ?? [])
    .map(([campo, titulo]) => [campo, blocoPorTitulo(titulo)])
    .filter(([, cols]) => cols)

  // Alíquota: valor único da linha, achado pelo rótulo da linha 3.
  let colAliquota = -1
  if (cfg.aliquotaRotulo && cab - 1 >= 1) {
    for (let c = r.s.c; c <= r.e.c; c++) {
      if (lim(texto(cab - 1, c)) === cfg.aliquotaRotulo) {
        colAliquota = c
        break
      }
    }
  }

  if (primeira.length !== 12) {
    const onde = XLSX.utils.encode_col(primeira[0])
    throw new Error(
      `O primeiro bloco de meses da aba "${cfg.aba}" tem ${primeira.length} coluna(s), começando em ${onde}; ` +
        'esperava exatamente 12. Alguma coluna foi inserida ou removida no meio dos meses — importar assim ' +
        'leria o bloco errado da planilha.'
    )
  }
  const meses = primeira
  const ano = anoDoSerial(bruto(cab, meses[0]).v)

  const linhas = []
  // Linhas com dimensão preenchida mas nenhum valor. São contadas para a tela
  // poder dizer por que apareceram só N: sem isso, quem preencheu a planilha e
  // esqueceu os meses não tem como saber que a linha foi descartada. As linhas
  // completamente vazias — a aba tem milhares — não entram nesta conta.
  let ignoradas = 0
  for (let l = cab + 1; l <= r.e.r + 1; l++) {
    const empresa = texto(l, col[cfg.colEmpresa])
    // "x" e "xx" são as colunas/linhas separadoras do template, não dado
    if (lim(empresa) === 'X') continue

    const valores = meses.map((c, i) => ({ mes: i + 1, valor: (numero(l, c) ?? 0) * cfg.sinal }))
    const t = (nome) => (col[nome] === undefined ? '' : texto(l, col[nome]))
    const campos = cfg.monta(t)

    // Toda coluna da linha que tem conteúdo, para nada da planilha se perder em
    // silêncio. O rótulo é a chave normalizada do cabeçalho — "Linha P&L" vira
    // "LINHA P L", porque o & não é letra nem número.
    const extras = []
    for (const [rotulo, nome] of cfg.extras ?? []) {
      const c = col[rotulo]
      if (c === undefined) continue
      const v = paraTexto(bruto(l, c)?.v, rotulo)
      if (util(v)) extras.push(`${nome}: ${v}`)
    }

    if (!valores.some((v) => v.valor !== 0)) {
      if (util(empresa) || util(campos.contaCodigo) || util(campos.contaRotulo)) ignoradas += 1
      continue
    }

    // Um objeto por mês com o que cada bloco derivado diz. A proporção é
    // adimensional; os demais são dinheiro e seguem o sinal do tipo.
    const porMes = valores.map((v) => ({ mes: v.mes, valor: v.valor }))
    for (const [campo, cols] of derivados) {
      const escala = campo === 'proporcao' ? 1 : cfg.sinal
      cols.forEach((c, i) => {
        const n = numero(l, c)
        if (n !== null) porMes[i][campo] = n * escala
      })
    }

    linhas.push({
      linha: l,
      empresa,
      ...campos,
      extras,
      obs: [campos.obs, ...extras].filter(Boolean).join(' | '),
      aliquota: colAliquota === -1 ? null : numero(l, colAliquota),
      taxaEfetiva: col['TAXA EFETIVA'] === undefined ? null : numero(l, col['TAXA EFETIVA']),
      mesReajuste: col['MES REAJUSTE'] === undefined ? null : numero(l, col['MES REAJUSTE']),
      indiceReajuste: col['INDICE PROJETADO'] === undefined ? '' : texto(l, col['INDICE PROJETADO']),
      valores: porMes,
      total: porMes.reduce((a, v) => a + v.valor, 0),
    })
  }
  return { tipo, aba: cfg.aba, ano, linhas, ignoradas }
}
