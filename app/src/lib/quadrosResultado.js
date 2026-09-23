/**
 * Os quadros do Resultado, um por aba, na ordem das abas da Master Resultado.
 *
 * Cada quadro é uma função pura que devolve { grupos, linhas, notas }:
 *
 *   grupos  as faixas do cabeçalho, cada uma com as suas colunas
 *           { key, label, fmt: 'mi' | 'pct' | 'pp', papel: 'atual' | 'orcado' | 'ly' }
 *   linhas  { rotulo, tipo, nivel?, indice?, v: { [key]: número | null } }
 *
 * A mesma saída serve à tabela da tela e à exportação — o arquivo nunca
 * diverge do que se vê. Os valores saem em R$ (a tela é quem divide por
 * milhão) e com o sinal da Master: receita positiva, gasto negativo.
 *
 * Budget e Last Year: "Budget" é a versão escolhida em "Comparar com";
 * "Last Year" é o budget do ano anterior (a versão de referência do ciclo
 * ano − 1). Onde a Master tem RFC — reforecast, que orçamento não tem — o
 * lugar fica com o Last Year.
 */
import {
  MESES,
  janela,
  pctNR,
  delta,
  demonstrativo,
  classificar,
  PL_CONTABIL,
  PL_MES_A_MES,
  RESUMO,
  MEDIDAS_MOM,
  GRUPOS_CAPEX,
} from './demonstrativo.js'

const NIVEL = ['bu', 'torre', 'sub', 'empresa']
const NOME_NIVEL = { consolidado: 'Consolidado', bu: 'BU', torre: 'Torre', sub: 'Sub Torre', empresa: 'Empresa' }
const demoDoNo = (no) => (no ? demonstrativo((c) => no.base?.get(c)) : null)

/** A árvore em lista, com a numeração do painel (1, 1.1, 1.1.1). */
function achatar(arvore, prefixo = '') {
  const saida = []
  arvore.forEach((no, i) => {
    const indice = prefixo ? `${prefixo}.${i + 1}` : `${i + 1}`
    saida.push({ ...no, indice })
    saida.push(...achatar(no.filhos ?? [], indice))
  })
  return saida
}

/** O mesmo nó na outra versão (Budget ou LY), pela chave do caminho. */
const noEm = (dados, chave) => dados?.estrutura?.find((x) => x.chave === chave) ?? null

/**
 * O bloco de comparação de uma medida: Actual, Budget, ∆ e Last Year, com os
 * % NR opcionais. `ids` prefixa as chaves para dois blocos não colidirem.
 */
function colunasBloco(id, { comNR = true, comBudget, comLy, comDeltaPct = true }) {
  const c = [{ key: `${id}.a`, label: 'Actual', fmt: 'mi', papel: 'atual' }]
  if (comNR) c.push({ key: `${id}.anr`, label: '% NR', fmt: 'pct' })
  if (comBudget) {
    c.push({ key: `${id}.b`, label: 'Budget', fmt: 'mi', papel: 'orcado' })
    if (comNR) c.push({ key: `${id}.bnr`, label: '% NR', fmt: 'pct' })
    c.push({ key: `${id}.bd`, label: '∆', fmt: 'mi' })
    if (comDeltaPct) c.push({ key: `${id}.bdp`, label: '∆%', fmt: 'pct', semaforo: true })
  }
  if (comLy) {
    c.push({ key: `${id}.l`, label: 'Last Year', fmt: 'mi', papel: 'ly' })
    if (comNR) c.push({ key: `${id}.lnr`, label: '% NR', fmt: 'pct' })
    c.push({ key: `${id}.ld`, label: '∆', fmt: 'mi' })
    if (comDeltaPct) c.push({ key: `${id}.ldp`, label: '∆%', fmt: 'pct' })
  }
  return c
}

/** Os valores de um bloco. `a`, `b`, `l` são os números; `nr*` as bases. */
function valoresBloco(id, { a, nrA, b, nrB, l, nrL }) {
  const v = { [`${id}.a`]: a, [`${id}.anr`]: pctNR(a, nrA) }
  if (b !== undefined) {
    const d = delta(a, b)
    Object.assign(v, { [`${id}.b`]: b, [`${id}.bnr`]: pctNR(b, nrB), [`${id}.bd`]: d.d, [`${id}.bdp`]: d.p })
  }
  if (l !== undefined) {
    const d = delta(a, l)
    Object.assign(v, { [`${id}.l`]: l, [`${id}.lnr`]: pctNR(l, nrL), [`${id}.ld`]: d.d, [`${id}.ldp`]: d.p })
  }
  return v
}

/** O que cada contexto tem: versão atual, Budget e LY, já no demonstrativo. */
function versoes(ctx) {
  return {
    A: ctx.dados.demo,
    B: ctx.comp?.demo ?? null,
    L: ctx.ly?.demo ?? null,
  }
}

/** Linhas de aviso: o que tem valor e não cabe em linha nenhuma. */
function alertas(ctx, montar) {
  const saida = []
  const semConta = ctx.dados.semConta ?? []
  if (semConta.some((x) => x)) saida.push({ rotulo: 'Sem conta · fora do P&L', tipo: 'alerta', v: montar(semConta.map((x) => -x)) })
  for (const f of ctx.dados.foraDaMaster ?? []) {
    saida.push({ rotulo: `${f.chave} · fora da estrutura`, tipo: 'alerta', v: montar(f.valores.map((x) => -x)) })
  }
  return saida
}

const temValor = (demo, s) => demo && demo[s]?.some((x) => x)

// ---------------------------------------------------------------------------

/**
 * Visão Torres (o Painel Resultado MoM da Master): a estrutura inteira, mês a
 * mês, de uma medida. O YTD tem a coluna % NR ao lado: nos gastos e
 * subtotais, sobre a Net Revenue da própria linha (torre, sub torre...); na
 * medida Net Revenue, sobre a do consolidado — quanto a linha é do total.
 */
function painelMoM(ctx) {
  const { mes } = ctx
  const medida = ctx.medida ?? 'nr'
  const comBudget = Boolean(ctx.comp)
  const comLy = Boolean(ctx.ly)
  const grupos = [
    {
      rotulo: `${MEDIDAS_MOM.find((m) => m.valor === medida)?.rotulo ?? medida} · Actual`,
      colunas: MESES.map((m, i) => ({ key: `m${i}`, label: m, fmt: 'mi', papel: i === mes - 1 ? 'atual' : undefined })),
    },
    {
      rotulo: `YTD ${MESES[mes - 1]}`,
      colunas: colunasBloco('ytd', { comBudget, comLy }),
    },
  ]
  const { A, B, L } = versoes(ctx)
  const nrYtd = (d) => janela(d?.nr ?? [], 'YTD', mes)
  // Net Revenue sobre ela mesma daria 100% em toda linha: vira participação no consolidado.
  const base = (d, cons) => nrYtd(medida === 'nr' ? cons : d)
  const linha = (rotulo, tipo, nivel, indice, dA, dB, dL) => {
    const serie = dA?.[medida] ?? []
    const v = {}
    MESES.forEach((_, i) => (v[`m${i}`] = serie[i] ?? 0))
    Object.assign(
      v,
      valoresBloco('ytd', {
        a: janela(serie, 'YTD', mes),
        nrA: base(dA, A),
        b: comBudget ? janela(dB?.[medida] ?? [], 'YTD', mes) : undefined,
        nrB: base(dB, B),
        l: comLy ? janela(dL?.[medida] ?? [], 'YTD', mes) : undefined,
        nrL: base(dL, L),
      })
    )
    return { rotulo, tipo, nivel, indice, v }
  }
  const linhas = [linha('Consolidado', 'consolidado', -1, '=', A, B, L), { tipo: 'respiro' }]
  for (const no of achatar(ctx.dados.arvore ?? [])) {
    linhas.push(
      linha(no.nome, NIVEL[Math.min(no.nivel, 3)], no.nivel, no.indice, demoDoNo(no), demoDoNo(noEm(ctx.comp, no.chave)), demoDoNo(noEm(ctx.ly, no.chave)))
    )
  }
  return { grupos, linhas, comIndice: true }
}

/**
 * Visão P&L (o P&L por Empresa MoM da Master): o P&L de uma empresa, ou do
 * consolidado, mês a mês, e o FY com o % NR. Nas linhas de receita (Gross e
 * Net Revenue) o % NR fica vazio, porque é a própria base.
 */
const semNR = new Set(['gr', 'nr'])

function plPorEmpresaMoM(ctx) {
  const { mes } = ctx
  if (ctx.modoEmpresa === 'lado') return plEmpresasLadoALado(ctx)
  const emp = ctx.dados.empresas?.find((e) => e.id === ctx.empresaPl) ?? null
  const demo = emp ? emp.demo : ctx.dados.demo
  const grupos = [
    {
      rotulo: `${emp?.nome ?? 'Consolidado'} · Actual`,
      colunas: MESES.map((m, i) => ({ key: `m${i}`, label: m, fmt: 'mi', papel: i === mes - 1 ? 'atual' : undefined })),
    },
    { rotulo: 'FY', colunas: [{ key: 'fy', label: 'Actual', fmt: 'mi', papel: 'atual' }, { key: 'fynr', label: '% NR', fmt: 'pct' }] },
  ]
  const nrF = janela(demo.nr, 'FY', mes)
  const linhas = []
  for (const l of PL_CONTABIL) {
    if (l.soComValor && !temValor(demo, l.s)) continue
    const serie = demo[l.s]
    const comNR = !semNR.has(l.s)
    const v = {}
    MESES.forEach((_, i) => (v[`m${i}`] = serie[i]))
    const f = janela(serie, 'FY', mes)
    Object.assign(v, { fy: f, fynr: comNR ? pctNR(f, nrF) : null })
    linhas.push({ rotulo: l.rotulo, tipo: l.tipo, v })
  }
  return { grupos, linhas }
}

/** A variante com as empresas lado a lado, no período YTD do mês escolhido. */
function plEmpresasLadoALado(ctx) {
  const { mes } = ctx
  const empresas = ctx.dados.empresas ?? []
  const grupos = [
    {
      rotulo: `Empresas · YTD ${MESES[mes - 1]}`,
      colunas: empresas.flatMap((e) => [
        { key: `e:${e.id ?? e.nome}`, label: e.nome, fmt: 'mi' },
        { key: `e:${e.id ?? e.nome}:nr`, label: '% NR', fmt: 'pct' },
      ]),
    },
    {
      rotulo: 'Consolidado',
      colunas: [
        { key: 'cons', label: 'Actual', fmt: 'mi', papel: 'atual' },
        { key: 'consnr', label: '% NR', fmt: 'pct' },
      ],
    },
  ]
  const ytd = (demo, s) => janela(demo[s], 'YTD', mes)
  const linhas = []
  for (const l of PL_CONTABIL) {
    if (l.soComValor && !temValor(ctx.dados.demo, l.s)) continue
    const comNR = !semNR.has(l.s)
    const cons = ytd(ctx.dados.demo, l.s)
    const v = { cons, consnr: comNR ? pctNR(cons, ytd(ctx.dados.demo, 'nr')) : null }
    for (const e of empresas) {
      const k = `e:${e.id ?? e.nome}`
      v[k] = ytd(e.demo, l.s)
      v[`${k}:nr`] = comNR ? pctNR(v[k], ytd(e.demo, 'nr')) : null
    }
    linhas.push({ rotulo: l.rotulo, tipo: l.tipo, v })
  }
  return { grupos, linhas }
}

/** P&L Contábil: MTD e YTD lado a lado, cada um com Budget e Last Year. */
function plContabil(ctx) {
  const { mes } = ctx
  const comBudget = Boolean(ctx.comp)
  const comLy = Boolean(ctx.ly)
  const { A, B, L } = versoes(ctx)
  const grupos = ['MTD', 'YTD'].map((per) => ({
    rotulo: `${per} · ${per === 'MTD' ? MESES[mes - 1] : `Jan–${MESES[mes - 1]}`}`,
    colunas: colunasBloco(per, { comBudget, comLy }),
  }))
  const bases = Object.fromEntries(
    ['MTD', 'YTD'].map((per) => [
      per,
      {
        nrA: janela(A.nr, per, mes),
        nrB: B ? janela(B.nr, per, mes) : null,
        nrL: L ? janela(L.nr, per, mes) : null,
      },
    ])
  )
  const valor = (demo, s, per) => (demo ? janela(demo[s], per, mes) : undefined)
  const linhas = []
  for (const l of PL_CONTABIL) {
    if (l.soComValor && !temValor(A, l.s) && !temValor(B, l.s) && !temValor(L, l.s)) continue
    const v = {}
    for (const per of ['MTD', 'YTD']) {
      Object.assign(
        v,
        valoresBloco(per, {
          a: valor(A, l.s, per),
          nrA: bases[per].nrA,
          b: comBudget ? valor(B, l.s, per) : undefined,
          nrB: bases[per].nrB,
          l: comLy ? valor(L, l.s, per) : undefined,
          nrL: bases[per].nrL,
        })
      )
    }
    linhas.push({ rotulo: l.rotulo, tipo: l.tipo, v })
  }
  linhas.push(
    ...alertas(ctx, (serie) => {
      const v = {}
      for (const per of ['MTD', 'YTD']) v[`${per}.a`] = janela(serie, per, mes)
      return v
    })
  )
  return { grupos, linhas }
}

/**
 * Um quadro por estrutura (Consolidado → BU → Torre → Sub Torre → Empresa),
 * com um bloco por medida. É o Capex (YTD) e o painel da conferência de
 * importação.
 */
function quadroEstrutura(ctx, medidas, periodo) {
  const { mes } = ctx
  const comBudget = Boolean(ctx.comp)
  const comLy = Boolean(ctx.ly)
  const grupos = medidas.map((m) => ({
    rotulo: m.rotulo,
    colunas: colunasBloco(m.s, { comNR: m.comNR, comBudget, comLy }),
  }))
  const linha = (rotulo, tipo, nivel, indice, dA, dB, dL) => {
    const v = {}
    const j = (d, s) => (d ? janela(d[s], periodo, mes) : 0)
    for (const m of medidas) {
      Object.assign(
        v,
        valoresBloco(m.s, {
          a: j(dA, m.s),
          nrA: j(dA, 'nr'),
          b: comBudget ? j(dB, m.s) : undefined,
          nrB: j(dB, 'nr'),
          l: comLy ? j(dL, m.s) : undefined,
          nrL: j(dL, 'nr'),
        })
      )
    }
    return { rotulo, tipo, nivel, indice, v }
  }
  const { A, B, L } = versoes(ctx)
  const linhas = [linha('Consolidado', 'consolidado', -1, '=', A, B, L), { tipo: 'respiro' }]
  for (const no of achatar(ctx.dados.arvore ?? [])) {
    linhas.push(
      linha(no.nome, NIVEL[Math.min(no.nivel, 3)], no.nivel, no.indice, demoDoNo(no), demoDoNo(noEm(ctx.comp, no.chave)), demoDoNo(noEm(ctx.ly, no.chave)))
    )
  }
  return { grupos, linhas, comIndice: true }
}

function capexYtd(ctx) {
  return quadroEstrutura(ctx, GRUPOS_CAPEX.map((g) => ({ ...g, comNR: true })), 'YTD')
}

/**
 * Performance Overview: Net Revenue, EBITDA After Capex e a margem, no mês e
 * no YTD, Actual contra Budget e Last Year. A tela desenha em barras.
 */
function performance(ctx) {
  const { mes } = ctx
  const { A, B, L } = versoes(ctx)
  const serie = (d, s, per) => (d ? janela(d[s], per, mes) : null)
  const margem = (d, per) => (d ? pctNR(janela(d.eac, per, mes), janela(d.nr, per, mes)) : null)
  const blocos = [
    { rotulo: 'Net Revenue', fmt: 'mi', f: (d, per) => serie(d, 'nr', per) },
    { rotulo: 'EBITDA After CAPEX', fmt: 'mi', f: (d, per) => serie(d, 'eac', per) },
    { rotulo: '% Margin', fmt: 'pct', f: margem },
  ]
  const grupos = ['MTD', 'YTD'].map((per) => ({
    rotulo: per === 'MTD' ? `Mês · ${MESES[mes - 1]}` : `YTD · Jan–${MESES[mes - 1]}`,
    colunas: [
      { key: `${per}.a`, label: 'Actual', papel: 'atual' },
      ...(B ? [{ key: `${per}.b`, label: 'Budget', papel: 'orcado' }] : []),
      ...(L ? [{ key: `${per}.l`, label: 'Last Year', papel: 'ly' }] : []),
    ],
  }))
  const linhas = blocos.map((b) => {
    const v = {}
    for (const per of ['MTD', 'YTD']) {
      v[`${per}.a`] = b.f(A, per)
      if (B) v[`${per}.b`] = b.f(B, per)
      if (L) v[`${per}.l`] = b.f(L, per)
    }
    return { rotulo: b.rotulo, tipo: 'linha', fmt: b.fmt, v }
  })
  return { grupos, linhas, grafico: true }
}

/** Painel Resumo: as sete linhas da Master, MTD e YTD, contra Budget e LY. */
function resumo(ctx) {
  const { mes } = ctx
  const { A, B, L } = versoes(ctx)
  const col = (per) => [
    { key: `${per}.a`, label: 'Actual', fmt: 'mi', papel: 'atual' },
    ...(B
      ? [
          { key: `${per}.b`, label: 'Budget', fmt: 'mi', papel: 'orcado' },
          { key: `${per}.bd`, label: '∆', fmt: 'mi' },
          { key: `${per}.bdp`, label: '∆%', fmt: 'pct', semaforo: true },
        ]
      : []),
    ...(L
      ? [
          { key: `${per}.l`, label: 'Last Year', fmt: 'mi', papel: 'ly' },
          { key: `${per}.ld`, label: '∆', fmt: 'mi' },
          { key: `${per}.ldp`, label: '∆%', fmt: 'pct' },
        ]
      : []),
  ]
  const grupos = [
    { rotulo: `MTD · ${MESES[mes - 1]}`, colunas: col('MTD') },
    { rotulo: `YTD · Jan–${MESES[mes - 1]}`, colunas: col('YTD') },
  ]
  const linhas = RESUMO.map((r) => {
    const v = {}
    for (const per of ['MTD', 'YTD']) {
      const x = (d) => {
        if (!d) return null
        return r.pct ? pctNR(janela(d[r.pct], per, mes), janela(d.nr, per, mes)) : janela(d[r.s], per, mes)
      }
      const a = x(A)
      v[`${per}.a`] = a
      if (B) {
        const b = x(B)
        v[`${per}.b`] = b
        // Margem compara em ponto percentual, não em % de %.
        v[`${per}.bd`] = a !== null && b !== null ? a - b : null
        v[`${per}.bdp`] = r.pct ? null : delta(a, b).p
      }
      if (L) {
        const l = x(L)
        v[`${per}.l`] = l
        v[`${per}.ld`] = a !== null && l !== null ? a - l : null
        v[`${per}.ldp`] = r.pct ? null : delta(a, l).p
      }
    }
    return { rotulo: r.rotulo, tipo: r.pct ? 'pct' : 'linha', fmt: r.pct ? 'pct' : 'mi', fmtDelta: r.pct ? 'pp' : 'mi', v }
  })
  return { grupos, linhas }
}

/** Budget mês a mês: o ano aberto, com o FY contra Budget e Last Year. */
function budgetMesAMes(ctx) {
  const { A, B, L } = versoes(ctx)
  const grupos = [
    { rotulo: `${ctx.rotuloVersao ?? 'Actual'}`, colunas: MESES.map((m, i) => ({ key: `m${i}`, label: m, fmt: 'mi' })) },
    {
      rotulo: 'FY',
      colunas: [
        { key: 'fy', label: 'Actual', fmt: 'mi', papel: 'atual' },
        { key: 'fynr', label: '% NR', fmt: 'pct' },
        ...(B ? [{ key: 'b', label: ctx.rotuloComp ?? 'Budget', fmt: 'mi', papel: 'orcado' }, { key: 'bnr', label: '% NR', fmt: 'pct' }] : []),
        ...(L ? [{ key: 'l', label: ctx.rotuloLy ?? 'Last Year', fmt: 'mi', papel: 'ly' }, { key: 'lnr', label: '% NR', fmt: 'pct' }, { key: 'yoy', label: 'YoY', fmt: 'pct' }] : []),
      ],
    },
  ]
  const fy = (d, s) => (d ? janela(d[s], 'FY') : null)
  const linhas = []
  for (const l of PL_MES_A_MES) {
    if (l.soComValor && !temValor(A, l.s)) continue
    const v = {}
    if (l.tipo === 'pct') {
      MESES.forEach((_, i) => (v[`m${i}`] = pctNR(A[l.s][i], A.nr[i])))
      v.fy = pctNR(fy(A, l.s), fy(A, 'nr'))
      if (B) v.b = pctNR(fy(B, l.s), fy(B, 'nr'))
      if (L) v.l = pctNR(fy(L, l.s), fy(L, 'nr'))
      linhas.push({ rotulo: l.rotulo, tipo: 'pct', fmt: 'pct', v })
      continue
    }
    MESES.forEach((_, i) => (v[`m${i}`] = A[l.s][i]))
    v.fy = fy(A, l.s)
    v.fynr = pctNR(v.fy, fy(A, 'nr'))
    if (B) {
      v.b = fy(B, l.s)
      v.bnr = pctNR(v.b, fy(B, 'nr'))
    }
    if (L) {
      v.l = fy(L, l.s)
      v.lnr = pctNR(v.l, fy(L, 'nr'))
      v.yoy = delta(v.fy, v.l).p
    }
    linhas.push({ rotulo: l.rotulo, tipo: l.tipo, v })
  }
  return { grupos, linhas }
}


/** Gastos por pacote: pacote e subpacote, no YTD, com o % RoL. */
function pacotes(ctx) {
  const { mes } = ctx
  // `area` vazia é "todas": o quadro soma o pacote inteiro. Com uma área
  // escolhida (G&A, CoGS, R&D...), cada pacote entra só com a parte dela.
  const area = ctx.areaPacote || ''
  const serie = (x) => (area ? x.areas?.[area] ?? [] : x.valores)
  const nr = janela(ctx.dados.demo.nr, 'YTD', mes)
  const rotuloGrupo = area ? `Gastos · ${area} · YTD ${MESES[mes - 1]}` : `Gastos · YTD ${MESES[mes - 1]}`
  const grupos = [{ rotulo: rotuloGrupo, colunas: [{ key: 'a', label: 'Actual', fmt: 'mi', papel: 'atual' }, { key: 'nr', label: '% RoL', fmt: 'pct' }] }]
  const linhas = []
  let total = 0
  for (const p of ctx.dados.pacotes ?? []) {
    const t = -janela(serie(p), 'YTD', mes)
    // Com filtro, pacote sem gasto na área escolhida sai da tabela: deixá-lo
    // zerado esconderia os que importam no meio de dezenas de linhas vazias.
    if (area && !t) continue
    total += t
    if (linhas.length) linhas.push({ tipo: 'respiro' })
    linhas.push({ rotulo: p.nome, tipo: 'grupo', v: { a: t, nr: pctNR(t, nr) } })
    for (const s of p.subpacotes) {
      const x = -janela(serie(s), 'YTD', mes)
      if (area && !x) continue
      linhas.push({ rotulo: s.nome, tipo: 'filha', v: { a: x, nr: pctNR(x, nr) } })
    }
  }
  linhas.push({ tipo: 'respiro' }, { rotulo: '= Total de gastos', tipo: 'subtotal', v: { a: total, nr: pctNR(total, nr) } })
  return {
    grupos,
    linhas,
    notas: [
      'O pacote vem da coluna “Pacote” do template, não do plano de contas. Por isso este total inclui os lançamentos cuja conta ainda não está cadastrada, que o P&L deixa de fora.',
      ...(area ? [`Filtrado pela área “${area}”: pacote sem gasto nessa área não aparece.`] : []),
    ],
  }
}

/**
 * As abas, na ordem das abas da Master. As três últimas não existem na Master
 * e ficam depois de propósito.
 */
export const ABAS = [
  { valor: 'mom', rotulo: 'Visão Torres', montar: painelMoM },
  { valor: 'plEmpresa', rotulo: 'Visão P&L', montar: plPorEmpresaMoM },
  { valor: 'pl', rotulo: 'P&L Contábil', montar: plContabil },
  { valor: 'capex', rotulo: 'Capex (YTD)', montar: capexYtd },
  { valor: 'performance', rotulo: 'Performance Overview', montar: performance },
  { valor: 'resumo', rotulo: 'Painel Resumo', montar: resumo },
  { valor: 'mensal', rotulo: 'Budget mês a mês', montar: budgetMesAMes },
  { valor: 'pacotes', rotulo: 'Gastos por pacote', montar: pacotes, foraDaMaster: true },
]

export function montarQuadro(aba, ctx) {
  const a = ABAS.find((x) => x.valor === aba)
  if (!a) throw new Error(`Aba "${aba}" não existe.`)
  return a.montar(ctx)
}

/**
 * O quadro em linhas de planilha, para exportar: uma coluna por coluna da
 * tela, com o nome da faixa na frente ("MTD · Jul Budget"), valores em R$.
 */
export function quadroParaExportar(quadro, { aba, recorte }) {
  const colunas = [
    ...(quadro.comIndice ? [{ key: 'Nível', grupo: 'Linha' }] : []),
    { key: 'Linha', grupo: 'Linha', obrigatorio: true },
    ...quadro.grupos.flatMap((g) => g.colunas.map((c) => ({ key: `${g.rotulo} · ${c.label}`, grupo: g.rotulo, _k: c.key }))),
  ]
  const linhas = quadro.linhas
    .filter((l) => l.tipo !== 'respiro')
    .map((l) => {
      const saida = { Linha: l.rotulo ?? '' }
      // O nível no lugar do índice (1.2.3): é o que se filtra no Excel.
      if (quadro.comIndice) saida['Nível'] = NOME_NIVEL[l.tipo] ?? ''
      for (const c of colunas) {
        if (!c._k) continue
        const x = l.v?.[c._k]
        saida[c.key] = x === null || x === undefined || !isFinite(x) ? '' : Math.round(x * 100) / 100
      }
      return saida
    })
  const sufixo = String(recorte ?? 'Consolidado').replace(/[\\/:*?"<>|]/g, '-')
  const nomeAba = ABAS.find((a) => a.valor === aba)?.rotulo.replace(/[^A-Za-z0-9]+/g, '') ?? aba
  return {
    nomeArquivo: `Resultado_${nomeAba}_${sufixo}`,
    chavePreferencia: `Resultado_${nomeAba}`,
    colunas: colunas.map(({ _k, ...c }) => c),
    linhas,
  }
}

/**
 * Os big numbers: Net Revenue, Gross Margin, Expenses, Labor, Non Labor e EAC
 * no YTD do mês de referência, cada um com o % RoL. Expenses é o "(-)
 * Expenses" da Master (sem o COGS); Labor é a parte dele marcada como Labor
 * na Linha P&L da Base Gastos; Non Labor, o resto. Gastos saem positivos
 * aqui — é um número de destaque, não uma linha do P&L.
 *
 * Os deltas vão contra o Budget e contra o Last Year: em R$ no Net Revenue e
 * em ponto percentual nos demais, porque o que se compara é a margem.
 */
export function bigNumbers(ctx) {
  const { mes } = ctx
  const med = (dados) => {
    if (!dados) return null
    const d = dados.demo
    const y = (s) => janela(d[s], 'YTD', mes)
    const expenses = -y('expenses')
    const labor = janela(dados.laborExpenses ?? [], 'YTD', mes)
    return { nr: y('nr'), gm: y('gm'), expenses, labor, nonLabor: expenses - labor, eac: y('eac') }
  }
  const a = med(ctx.dados)
  const b = med(ctx.comp)
  const l = med(ctx.ly)
  const pp = (k, x) => (x && a.nr && x.nr ? pctNR(a[k], a.nr) - pctNR(x[k], x.nr) : null)
  const item = (chave, rotulo) => ({
    chave,
    rotulo,
    valor: a[chave],
    pct: chave === 'nr' ? null : pctNR(a[chave], a.nr),
    vsBudget: b ? (chave === 'nr' ? { valor: a.nr - b.nr } : { pp: pp(chave, b) }) : null,
    vsLy: l ? (chave === 'nr' ? { valor: a.nr - l.nr } : { pp: pp(chave, l) }) : null,
    // Gasto maior é pior: o delta de Expenses, Labor e Non Labor inverte a cor.
    menorEMelhor: ['expenses', 'labor', 'nonLabor'].includes(chave),
  })
  return [
    item('nr', 'Net Revenue'),
    item('gm', 'Gross Margin'),
    item('expenses', 'Expenses'),
    item('labor', 'Labor'),
    item('nonLabor', 'Non Labor'),
    item('eac', 'EAC'),
  ]
}

/**
 * Os quadros da conferência da importação: o que o ARQUIVO faz com o P&L e com
 * a estrutura, antes de gravar, no mesmo formato da Master que o Resultado usa.
 *
 * `itens` são as linhas casadas ({ tipo, conta, area, area_ajustada, meses });
 * `agrupado` é o agruparPorEstrutura delas (com `chave`). Arquivo só de gastos
 * não traz receita: aí o % NR usa a receita já lançada na versão.
 */
export function quadrosDoArquivo({ itens, agrupado, receitaDaVersao = 0 }) {
  const base = new Map()
  let semConta = Array(12).fill(0)
  for (const it of itens) {
    const k = classificar(it)
    if (!k) semConta = semConta.map((v, i) => v + it.meses[i])
    else base.set(k, (base.get(k) ?? Array(12).fill(0)).map((v, i) => v + it.meses[i]))
  }
  const demo = demonstrativo((c) => base.get(c))
  const fy = (s) => janela(demo[s], 'FY')
  const nr = fy('nr') || receitaDaVersao || 0
  const pl = {
    grupos: [{ rotulo: 'Este arquivo · FY', colunas: [{ key: 'a', label: 'Actual', fmt: 'mi', papel: 'atual' }, { key: 'nr', label: '% NR', fmt: 'pct' }] }],
    linhas: [],
  }
  for (const l of PL_CONTABIL) {
    const v = fy(l.s)
    // Só o que o arquivo mexe, mais os subtotais: o esqueleto inteiro zerado
    // esconderia as três linhas que importam.
    if (l.tipo !== 'subtotal' && !v) continue
    pl.linhas.push({ rotulo: l.rotulo, tipo: l.tipo, v: { a: v, nr: pctNR(v, nr) } })
  }
  const sc = janela(semConta, 'FY')
  if (sc) pl.linhas.push({ rotulo: 'Sem conta · não entra em linha nenhuma', tipo: 'alerta', v: { a: -sc } })
  const painel = quadroEstrutura(
    { dados: { demo, arvore: agrupado.arvore }, comp: null, ly: null, mes: 12 },
    [
      { s: 'nr', rotulo: 'Net Revenue', comNR: false },
      { s: 'eac', rotulo: 'Adj. Ebitda After Capex', comNR: true },
    ],
    'FY'
  )
  return { pl, painel, semNR: !fy('nr') && Boolean(receitaDaVersao) }
}
