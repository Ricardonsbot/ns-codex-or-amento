/**
 * Exportação dos lançamentos de Receita, com as colunas do template.
 *
 * (As abas do Resultado exportam pelo próprio quadro — quadroParaExportar, em
 * quadrosResultado.js —, para o arquivo ser sempre o que está na tela.)
 *
 * Os valores saem em R$ cheios, e o módulo é puro: roda no Node para teste.
 */

export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const reais = (v) => (v === null || v === undefined || !isFinite(v) ? '' : Math.round(v * 100) / 100)

/** As 12 colunas de mês de um grupo, no formato do seletor. */
function colunasMes(grupo, prefixo = '') {
  return MESES.map((m) => ({ key: `${prefixo}${m}`, grupo }))
}

/**
 * Lançamentos de Receita, um por linha, com tudo o que o template trouxe.
 *
 * `lancamentos` vem do banco com `lancamento_valor_mensal(*)` e `conta`; os
 * nomes de BU, torre e empresa saem dos cadastros que a tela já carregou, para
 * não pesar a consulta.
 */
export function montarExportacaoReceita(lancamentos, { bus, torres, empresas, recorte }) {
  const nomeDe = (lista, id) => lista.find((x) => x.id === id)?.nome ?? ''
  const ident = [
    ['BU', (l) => nomeDe(bus, l.bu_id)],
    ['Torre', (l) => nomeDe(torres, l.torre_id)],
    ['Empresa', (l) => nomeDe(empresas, l.empresa_id) || l.empresa_texto || ''],
    ['Código da conta', (l) => l.conta?.codigo ?? ''],
    ['Conta', (l) => l.conta?.nome ?? l.conta_contabil_texto ?? ''],
    ['Linha do P&L', (l) => l.conta?.linha_pl ?? ''],
  ]
  const template = [
    ['Tipo Receita', 'tipo_receita'],
    ['Produto Sintético', 'produto_sintetico'],
    ['Produto Analítico', 'produto_analitico'],
    ['SKU', 'sku'],
    ['Cliente', 'cliente'],
    ['CNPJ', 'cnpj'],
    ['Persona', 'persona'],
    ['Segmento Sintético', 'segmento_sintetico'],
    ['Segmento Analítico', 'segmento_analitico'],
    ['Classe de Clientes', 'classe_cliente'],
    ['MRR', 'mrr'],
    ['Canetada', 'canetada'],
    ['Intercompany', 'intercompany'],
    ['PMR', 'pmr'],
    ['Termômetro de Vendas', 'termometro'],
    ['Projeto', 'projeto'],
    ['Descrição', 'descricao'],
    ['Obs', 'obs'],
  ]
  const reajuste = [
    ['Índice de reajuste', (l) => l.indice_reajuste ?? ''],
    ['Mês de reajuste', (l) => (l.mes_reajuste ? String(l.mes_reajuste).slice(0, 7) : '')],
    ['Taxa efetiva', (l) => l.taxa_efetiva ?? ''],
    ['Taxa de sucesso', (l) => l.taxa_sucesso ?? ''],
    ['Alíquota', (l) => l.aliquota ?? ''],
  ]
  // Os três blocos de 12 meses do template. O reajustado e o líquido só
  // existem nas linhas que vieram de template; as lançadas à mão têm só a base.
  // Bloco que nenhuma linha tem não entra: o líquido só vem no template 2027,
  // e doze colunas vazias no arquivo pareceriam dado faltando.
  const temCampo = (campo) =>
    lancamentos.some((l) => (l.lancamento_valor_mensal ?? []).some((m) => m[campo] !== null && m[campo] !== undefined))
  const blocos = [
    ['Base', 'valor', ''],
    ['Reajustado', 'valor_ajustado', 'Reaj. '],
    ['Líquido', 'valor_liquido', 'Líq. '],
  ].filter(([rotulo, campo]) => rotulo === 'Base' || temCampo(campo))

  const colunas = [
    ...ident.map(([k]) => ({ key: k, grupo: 'Identificação', obrigatorio: k === 'Empresa' })),
    ...template.map(([k]) => ({ key: k, grupo: 'Template' })),
    ...reajuste.map(([k]) => ({ key: k, grupo: 'Reajuste' })),
    ...blocos.flatMap(([rotulo, , prefixo]) => [
      ...colunasMes(`Valores ${rotulo.toLowerCase()}`, prefixo),
      { key: `Total ${rotulo.toLowerCase()}`, grupo: `Valores ${rotulo.toLowerCase()}` },
    ]),
  ]

  const linhas = lancamentos.map((l) => {
    const mensal = new Map((l.lancamento_valor_mensal ?? []).map((m) => [m.mes, m]))
    const saida = {}
    for (const [k, f] of ident) saida[k] = f(l)
    for (const [k, c] of template) saida[k] = l[c] ?? ''
    for (const [k, f] of reajuste) saida[k] = f(l)
    for (const [rotulo, campo, prefixo] of blocos) {
      const vals = MESES.map((_, i) => {
        const v = mensal.get(i + 1)?.[campo]
        return v === null || v === undefined ? null : Number(v)
      })
      const algum = vals.some((v) => v !== null)
      MESES.forEach((m, i) => (saida[`${prefixo}${m}`] = algum ? reais(vals[i] ?? 0) : ''))
      saida[`Total ${rotulo.toLowerCase()}`] = algum ? reais(vals.reduce((a, v) => a + (v ?? 0), 0)) : ''
    }
    return saida
  })

  const sufixo = String(recorte ?? 'Todas').replace(/[\\/:*?"<>|]/g, '-')
  return {
    nomeArquivo: `Revenue_Lancamentos_${sufixo}`,
    chavePreferencia: 'Revenue_Lancamentos',
    colunas,
    linhas,
  }
}
