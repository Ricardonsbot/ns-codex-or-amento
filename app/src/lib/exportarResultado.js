/**
 * O que cada aba do Resultado vira quando exportada.
 *
 * Sai a aba que está na tela, com o recorte que está na tela — quem exporta
 * espera o arquivo do que está vendo. Duas diferenças de propósito em relação à
 * tabela:
 *
 * Os valores saem em R$, não em R$ M com uma casa. A tela arredonda para caber;
 * o arquivo vai ser somado, filtrado e colado em outra planilha, e 0,1 mi de
 * arredondamento por linha vira diferença que ninguém acha depois.
 *
 * Os meses saem sempre, mesmo com a tela em "Ano". O seletor de colunas já
 * deixa tirar; o contrário — querer o mês e ter que voltar para trocar a visão —
 * é o caminho mais chato.
 *
 * Sem import de propósito: o módulo é puro e roda no Node, para dar para testar
 * sem banco e sem navegador.
 */

export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const anual = (v) => (v ?? []).reduce((a, b) => a + b, 0)
const reais = (v) => (v === null || v === undefined || !isFinite(v) ? '' : Math.round(v * 100) / 100)
/** Percentual como número (36,8 e não "36,8%"), para a planilha poder fazer conta. */
const pct = (v, base) => (base ? Math.round((v / base) * 1000) / 10 : '')

/** As 12 colunas de mês de um grupo, no formato do seletor. */
function colunasMes(grupo, prefixo = '') {
  return MESES.map((m) => ({ key: `${prefixo}${m}`, grupo }))
}

function porMes(valores, prefixo = '') {
  return Object.fromEntries(MESES.map((m, i) => [`${prefixo}${m}`, reais(valores?.[i] ?? 0)]))
}

/**
 * Monta a exportação da aba.
 *
 * `ctx` traz o que a tela já tem: `dados` e `comp` do fetchResultado, a `visao`
 * do P&L e o `recorte` (Consolidado, nome da BU, da torre ou da empresa), que
 * vai no nome do arquivo para dois recortes não se sobrescreverem na pasta.
 *
 * Devolve { nomeArquivo, chavePreferencia, colunas, linhas }. A escolha de
 * colunas é lembrada por `chavePreferencia`, que não leva o recorte: quem tirou
 * os meses do P&L da BRK quer o P&L da Onisys do mesmo jeito.
 */
export function montarExportacaoResultado(aba, { dados, comp, visao, recorte, abaRotulo }) {
  const base = anual(dados.subtotais.receitaLiquida)
  const sufixo = String(recorte ?? 'Consolidado').replace(/[\\/:*?"<>|]/g, '-')
  const nome = (tela) => ({
    nomeArquivo: `Resultado_${tela}_${sufixo}`,
    chavePreferencia: `Resultado_${tela}`,
  })
  const montar = MONTADORES[aba]
  if (!montar) throw new Error(`A aba "${abaRotulo ?? aba}" não tem exportação.`)
  return montar({ dados, comp, visao, base, nome })
}

const MONTADORES = {
  painel({ dados, comp, nome }) {
    const colunas = [
      { key: 'Nível', grupo: 'Estrutura' },
      { key: 'Índice', grupo: 'Estrutura' },
      { key: 'Nome', grupo: 'Estrutura', obrigatorio: true },
      { key: 'Net Revenue', grupo: 'Net Revenue' },
      ...(comp ? [{ key: 'Net Revenue Budget', grupo: 'Net Revenue' }, { key: 'Net Revenue Δ', grupo: 'Net Revenue' }] : []),
      { key: 'EBITDA after Capex', grupo: 'EBITDA after Capex' },
      { key: 'EBITDA after Capex %NR', grupo: 'EBITDA after Capex' },
      ...(comp
        ? [
            { key: 'EBITDA after Capex Budget', grupo: 'EBITDA after Capex' },
            { key: 'EBITDA after Capex Δ', grupo: 'EBITDA after Capex' },
          ]
        : []),
    ]
    const NIVEL = ['BU', 'Torre', 'Sub Torre', 'Empresa']
    const linhas = []
    const consolidadoNR = anual(dados.subtotais.receitaLiquida)
    const consolidadoEAC = anual(dados.subtotais.ebitdaAposCapex)
    linhas.push({
      'Nível': 'Consolidado',
      'Índice': '=',
      Nome: 'Consolidado',
      'Net Revenue': reais(consolidadoNR),
      'EBITDA after Capex': reais(consolidadoEAC),
      'EBITDA after Capex %NR': pct(consolidadoEAC, consolidadoNR),
      ...(comp && {
        'Net Revenue Budget': reais(anual(comp.subtotais.receitaLiquida)),
        'Net Revenue Δ': reais(consolidadoNR - anual(comp.subtotais.receitaLiquida)),
        'EBITDA after Capex Budget': reais(anual(comp.subtotais.ebitdaAposCapex)),
        'EBITDA after Capex Δ': reais(consolidadoEAC - anual(comp.subtotais.ebitdaAposCapex)),
      }),
    })
    const visitar = (nos, prefixo) =>
      nos.forEach((no, i) => {
        const numero = prefixo ? `${prefixo}.${i + 1}` : `${i + 1}`
        const rec = anual(no.receita)
        const eac = rec - anual(no.despesa) - anual(no.capex)
        const nb = comp?.estrutura?.find((x) => x.chave === no.chave)
        const recB = anual(nb?.receita)
        const eacB = recB - anual(nb?.despesa) - anual(nb?.capex)
        linhas.push({
          'Nível': NIVEL[Math.min(no.nivel, 3)],
          'Índice': numero,
          Nome: no.nome,
          'Net Revenue': reais(rec),
          'EBITDA after Capex': reais(eac),
          'EBITDA after Capex %NR': pct(eac, rec),
          ...(comp && {
            'Net Revenue Budget': reais(recB),
            'Net Revenue Δ': reais(rec - recB),
            'EBITDA after Capex Budget': reais(eacB),
            'EBITDA after Capex Δ': reais(eac - eacB),
          }),
        })
        visitar(no.filhos ?? [], numero)
      })
    visitar(dados.arvore ?? [], '')
    return { ...nome('Painel'), colunas, linhas }
  },

  empresas({ dados, base, nome }) {
    const colunas = [
      { key: 'Empresa', obrigatorio: true },
      { key: 'Net Revenue' },
      { key: 'EBITDA' },
      { key: 'EBITDA %NR' },
      { key: 'EBITDA after Capex' },
      { key: 'EBITDA after Capex %NR' },
      { key: 'Net Income' },
      { key: 'Net Income %NR' },
    ]
    const linha = (rotulo, nr, eb, ec, ni) => ({
      Empresa: rotulo,
      'Net Revenue': reais(nr),
      EBITDA: reais(eb),
      'EBITDA %NR': pct(eb, nr),
      'EBITDA after Capex': reais(ec),
      'EBITDA after Capex %NR': pct(ec, nr),
      'Net Income': reais(ni),
      'Net Income %NR': pct(ni, nr),
    })
    const linhas = dados.empresas.map((e) =>
      linha(e.nome, anual(e.receitaLiquida), anual(e.ebitda), anual(e.ebitdaAposCapex), anual(e.netIncome))
    )
    const st = dados.subtotais
    linhas.push(linha('Consolidado', base, anual(st.ebitda), anual(st.ebitdaAposCapex), anual(st.netIncome)))
    return { ...nome('PorEmpresa'), colunas, linhas }
  },

  pl({ dados, comp, visao, base, nome }) {
    const colunas = [
      { key: 'Linha do P&L', grupo: 'Linha', obrigatorio: true },
      { key: 'Tipo', grupo: 'Linha' },
      ...colunasMes('Mês a mês'),
      { key: 'Ano', grupo: 'Ano' },
      { key: '%NR', grupo: 'Ano' },
      ...(comp
        ? [
            { key: 'Budget', grupo: 'Comparação' },
            { key: 'Δ', grupo: 'Comparação' },
            { key: 'Δ%', grupo: 'Comparação' },
          ]
        : []),
    ]
    const doComp = comp ? comp.pls?.[visao] ?? comp.pl : null
    const linhas = []
    for (const l of dados.pls?.[visao] ?? dados.pl) {
      if (l.eSecao) {
        linhas.push({ 'Linha do P&L': l.rotulo, Tipo: 'Seção' })
        continue
      }
      const v = anual(l.valores)
      const saida = {
        'Linha do P&L': l.rotulo,
        Tipo: l.eSubtotal ? 'Subtotal' : 'Linha',
        ...porMes(l.valores),
        Ano: reais(v),
        '%NR': pct(v, base),
      }
      if (doComp) {
        const b = anual(doComp.find((x) => x.rotulo === l.rotulo)?.valores)
        saida.Budget = reais(b)
        saida['Δ'] = reais(v - b)
        saida['Δ%'] = b ? Math.round(((v - b) / Math.abs(b)) * 1000) / 10 : ''
      }
      linhas.push(saida)
    }
    // O que ficou fora da estrutura sai também: no arquivo, sumir com ele faria
    // a soma das linhas não bater com o total e ninguém saberia por quê.
    for (const f of dados.fora ?? []) {
      const v = anual(f.valores)
      linhas.push({
        'Linha do P&L': `${f.chave} · fora da estrutura do P&L`,
        Tipo: 'Fora da estrutura',
        ...porMes(f.valores),
        Ano: reais(v),
        '%NR': pct(v, base),
      })
    }
    return { ...nome(`PL_${visao}`), colunas, linhas }
  },

  plEmpresa({ dados, visao, nome }) {
    const colunas = [
      { key: 'Linha do P&L', obrigatorio: true },
      { key: 'Tipo' },
      ...dados.empresas.map((e) => ({ key: e.nome, grupo: 'Empresas' })),
      { key: 'Consolidado' },
    ]
    const linhas = []
    for (const l of dados.pls?.[visao] ?? dados.pl) {
      if (l.eSecao) {
        linhas.push({ 'Linha do P&L': l.rotulo, Tipo: 'Seção' })
        continue
      }
      const valorEmp = (e) => {
        if (l.subtotal) return e[l.subtotal] ? anual(e[l.subtotal]) : null
        if (l.area) return anual(e.porArea?.get(l.area) ?? [])
        return anual(e.porLinha.get(l.linha) ?? [])
      }
      linhas.push({
        'Linha do P&L': l.rotulo,
        Tipo: l.eSubtotal ? 'Subtotal' : 'Linha',
        ...Object.fromEntries(dados.empresas.map((e) => [e.nome, reais(valorEmp(e))])),
        Consolidado: reais(anual(l.valores)),
      })
    }
    return { ...nome(`PLPorEmpresa_${visao}`), colunas, linhas }
  },

  pacotes({ dados, base, nome }) {
    const colunas = [
      { key: 'Pacote', grupo: 'Pacote', obrigatorio: true },
      { key: 'Subpacote', grupo: 'Pacote' },
      ...colunasMes('Mês a mês'),
      { key: 'Ano', grupo: 'Ano' },
      { key: '% RoL', grupo: 'Ano' },
    ]
    // Uma linha por subpacote, com o pacote repetido: é o formato que a
    // tabela dinâmica do Excel lê. A linha de total do pacote não entra — ela
    // somaria duas vezes em qualquer SOMA da coluna.
    const linhas = []
    for (const p of dados.pacotes ?? []) {
      const subs = p.subpacotes?.length ? p.subpacotes : [{ nome: '', valores: p.valores }]
      for (const s of subs) {
        const v = anual(s.valores)
        linhas.push({ Pacote: p.nome, Subpacote: s.nome, ...porMes(s.valores), Ano: reais(v), '% RoL': pct(v, base) })
      }
    }
    return { ...nome('GastosPorPacote'), colunas, linhas }
  },

  areas({ dados, base, nome }) {
    const colunas = [
      { key: 'Área', obrigatorio: true },
      ...colunasMes('Mês a mês'),
      { key: 'Ano', grupo: 'Ano' },
      { key: '%NR', grupo: 'Ano' },
    ]
    const linhas = (dados.areas ?? []).map((a) => {
      const v = anual(a.valores)
      return { 'Área': a.nome, ...porMes(a.valores), Ano: reais(v), '%NR': pct(v, base) }
    })
    return { ...nome('PorArea'), colunas, linhas }
  },
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
