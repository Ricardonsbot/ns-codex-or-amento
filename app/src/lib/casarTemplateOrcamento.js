import { lim } from './lerTemplateOrcamento.js'
import { PREFIXO_PL } from './linhasPl.js'

/**
 * Casamento das linhas do template com os cadastros — puro, sem Supabase, para
 * que a tela e o script de linha de comando usem exatamente a mesma regra.
 */

/**
 * O template escreve o mesmo código ora com pontos, ora sem. Só zeros conta
 * como vazio: nas linhas em que a fórmula da planilha não achou a conta, a
 * célula fica com o número 0, e "conta 0 não existe" não ajuda ninguém.
 */
const soDigitos = (v) => {
  const d = String(v ?? '').replace(/\D/g, '')
  return /^0*$/.test(d) ? '' : d
}

/** O valor do ano da linha, já na convenção do banco. */
const totalDe = (l) => Number(l.total ?? (l.valores ?? []).reduce((a, v) => a + Number(v.valor ?? 0), 0))

/**
 * A linha veio com o sinal trocado?
 *
 * O template escreve gasto e capex como negativo, e a leitura nega o valor
 * para guardar a magnitude. Total negativo aqui quer dizer que a linha veio
 * positiva lá — e no P&L ela vai reduzir a despesa em vez de somar.
 *
 * A ferramenta não conserta: o número entra como veio e a linha sai
 * apontada. Quem sabe se aquilo é erro de digitação ou um crédito de
 * verdade é quem lançou.
 *
 * A dedução de receita é negativa por natureza e não conta.
 */
export function sinalInvertido(l, tipo, conta) {
  if (totalDe(l) >= 0) return false
  if (tipo !== 'receita') return true
  const linha = String(conta?.linha_pl || l.linha_pl_template || '')
  return !/deduc|deduct/i.test(linha)
}

/**
 * Monta o resolvedor de conta do tipo pedido.
 *
 * Receita casa pelo NOME, porque a aba só traz o rótulo da conta. Despesa e
 * Capex trazem o número, que é chave única — casa por ele, ignorando os pontos,
 * e o nome fica só como reserva.
 *
 * A conta encontrada ainda precisa ser do tipo certo: um código de Capex
 * digitado na aba de gastos tem que virar pendência, não despesa.
 */
export function montarResolvedorDeConta(contas, tipo, { aceitaTambem } = {}) {
  const prefixo = PREFIXO_PL[tipo]
  // `aceitaTambem` abre a porta para uma segunda natureza de conta. É o caso do
  // salário ativado: a linha é Capex pela área, mas a conta contábil continua
  // a de pessoal — "conta contábil respeitando a natureza original", como diz o
  // próprio plano de contas do template.
  const aceita = (c) =>
    (c.linha_pl || '').startsWith(prefixo) || (aceitaTambem && (c.linha_pl || '').startsWith(aceitaTambem))
  const doTipo = contas.filter(aceita)
  const porDigitos = new Map(contas.map((c) => [soDigitos(c.codigo), c]))

  // Entre candidatos de mesmo nome fica o de código mais curto: é a conta base,
  // não a sub-conta de provisão ou reversão.
  const porNome = (rotulo) => {
    const iguais = doTipo.filter((c) => lim(c.nome) === lim(rotulo))
    if (!iguais.length) return null
    return iguais.sort((a, b) => a.codigo.length - b.codigo.length || a.codigo.localeCompare(b.codigo))[0]
  }

  return (codigo, rotulo) => {
    const digitos = soDigitos(codigo)
    if (digitos) {
      const achada = porDigitos.get(digitos)
      if (!achada) return { erro: `Conta ${codigo} não existe no plano de contas` }
      if (!aceita(achada)) {
        return { erro: `Conta ${codigo} está no plano como "${achada.linha_pl}", não é ${prefixo}` }
      }
      return { conta: achada }
    }
    if (!rotulo) return { erro: 'Linha sem número nem nome de conta' }
    const achada = porNome(rotulo)
    if (!achada) return { erro: `"${rotulo}" não casa com nenhuma conta de ${prefixo.toLowerCase()}` }
    return { conta: achada }
  }
}

/**
 * Separa o que dá para gravar do que não dá.
 *
 *   prontas    empresa e conta resolvidas
 *   marcadas   empresa resolvida, conta não — entram SEM conta e sinalizadas,
 *              para o valor não ficar de fora do orçamento enquanto o plano de
 *              contas não acompanha a planilha
 *   fora       sem empresa — não há como gravar: `lancamento.bu_id` é
 *              obrigatório e a BU vem da empresa —, ou com texto numa coluna
 *              de valor, que é recusa direta: ninguém adivinha quanto vale
 *              uma frase, e deixá-la entrar como zero é pior do que barrar
 */
/**
 * A linha da Base Gastos é Capex? Quem diz é a **Linha P&L**, e só ela.
 *
 * A área não decide mais. Ela diz onde o gasto é alocado — COGS, G&A, S&M,
 * R&D —, não se ele é investimento; e enquanto ela decidia, uma linha com
 * "Capex" escrito na coluna de área saía da despesa sem que a Linha P&L
 * tivesse dito nada, e sem aparecer para ninguém.
 *
 *   Linha P&L do template    a ajustada manda sobre a original, como em todo
 *                            o resto; preenchida, é ela que decide, inclusive
 *                            para dizer que NÃO é capex
 *   conta de Capex no plano  a reserva de quando a coluna vem vazia: a Linha
 *                            P&L da conta no plano de contas
 */
export function linhaEhCapex(l, contas) {
  // O `|| ''` não é enfeite: sem ele, `lim(undefined)` vira "UNDEFINED", que
  // é texto e faz a coluna vazia parecer preenchida — e aí a conta do plano,
  // que é a reserva, nunca era consultada.
  const daLinha = lim(l.linha_pl_ajustada || l.linha_pl_template || '')
  if (daLinha) return daLinha.includes('CAPEX')
  const d = soDigitos(l.contaCodigo)
  if (!d) return false
  const c = contas.find((x) => soDigitos(x.codigo) === d)
  return Boolean(c && (c.linha_pl || '').startsWith(PREFIXO_PL.capex))
}

export function casar({ tipo, aba, linhas }, { empresas, contas }) {
  const porEmpresa = new Map(empresas.map((e) => [lim(e.nome), e]))
  // A Base Gastos traz despesa e Capex juntos (template 2027). Cada módulo
  // pega a sua parte e deixa a outra para o outro importar — assim importar os
  // dois não duplica nada, e substituir a despesa não apaga o Capex.
  const ehCapex = tipo === 'capex'
  // A aba vem por linha: o Capex junta a aba própria e a Base Gastos.
  const daBaseGastos = (l) => (l.aba ?? aba) === 'Base Gastos'
  const acharConta = montarResolvedorDeConta(contas, tipo)
  // Só o Capex da Base Gastos aceita conta de despesa: é o salário ativado.
  const acharContaAtivacao = montarResolvedorDeConta(contas, tipo, { aceitaTambem: PREFIXO_PL.despesa })

  const prontas = []
  const marcadas = []
  const fora = []
  const outroModulo = []
  for (const l of linhas) {
    if (daBaseGastos(l) && linhaEhCapex(l, contas) !== ehCapex) {
      outroModulo.push({ ...l, destino: ehCapex ? 'despesa' : 'capex' })
      continue
    }
    // Texto onde era para ter número: recusa antes de qualquer outra coisa.
    // Não adianta resolver empresa e conta de uma linha cujo valor ninguém
    // sabe qual é.
    if (l.naoNumericos?.length) {
      const quais = l.naoNumericos.map((x) => `${x.coluna}: "${x.valor}"`).join(' · ')
      fora.push({ ...l, falhas: [`Texto onde era para ter número — ${quais}`] })
      continue
    }

    const empresa = porEmpresa.get(lim(l.empresa))
    const { conta, erro } = (ehCapex && daBaseGastos(l) ? acharContaAtivacao : acharConta)(l.contaCodigo, l.contaRotulo)

    // Aviso é diferente de falha: a linha entra, e entra com o número que
    // veio. Só não entra calada.
    const avisos = sinalInvertido(l, tipo, conta) ? ['sinal invertido: no template o valor veio positivo'] : []

    if (!empresa) {
      const motivo = l.empresa ? `Empresa "${l.empresa}" não está cadastrada` : 'Linha sem empresa'
      fora.push({ ...l, avisos, falhas: erro ? [motivo, erro] : [motivo] })
    } else if (erro) {
      marcadas.push({ ...l, empresa, conta: null, avisos, falhas: [erro] })
    } else {
      prontas.push({ ...l, empresa, conta, avisos })
    }
  }
  return { prontas, marcadas, fora, pendentes: fora, outroModulo }
}

/**
 * Colunas acrescentadas pela migração 2026-09-08-blocos-derivados.sql. Ficam
 * listadas aqui porque quem grava precisa saber quais remover enquanto o SQL
 * não tiver sido rodado — sem isso o PostgREST recusa o insert inteiro.
 */
export const EXTRA_LANCAMENTO = ['aliquota', 'taxa_efetiva', 'mes_reajuste', 'indice_reajuste']
/** Da migração 2026-09-09-area-do-pl.sql, probada à parte das de cima. */
export const EXTRA_AREA = ['area']
/** Da migração 2026-09-10-schema-completo-do-template.sql, também probada à parte. */
export const EXTRA_PACOTE = ['pacote', 'subpacote']
export const EXTRA_MENSAL = ['proporcao', 'valor_ajustado', 'valor_liquido', 'valor_caixa']

/**
 * As colunas de 2026-09-10-schema-completo-do-template.sql. Probadas juntas,
 * porque vêm todas do mesmo arquivo: ou ele rodou, ou não rodou.
 */
export const EXTRA_TEMPLATE = [
  'linha_pl_template',
  'linha_pl_ajustada',
  'grupo_caixa',
  'area_ajustada',
  'empresa_texto',
  'torre_texto',
  'diretoria',
  'centro_custo_nome',
  'tipo_receita',
  'conta_contabil_texto',
  'produto_sintetico',
  'produto_analitico',
  'sku',
  'cliente',
  'cnpj',
  'persona',
  'segmento_sintetico',
  'segmento_analitico',
  'classe_cliente',
  'intercompany',
  'mrr',
  'canetada',
  'pmr',
  'termometro',
  'projeto',
  'auxiliar_conta',
  'subconta',
  'detalhamento',
  'item',
  'quantidade',
  'valor_unitario',
  'taxa_sucesso',
  'proporcao_manual',
  'extras',
]
/** O bloco "Reajuste" da aba Receita, do mesmo arquivo. */
export const EXTRA_MENSAL_NOVO = ['valor_reajuste']

/** Serial do Excel para 'aaaa-mm-dd', que é o que a coluna date espera. */
function dataDoSerial(n) {
  if (typeof n !== 'number' || n < 1) return null
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10)
}

/** Monta a linha da tabela `lancamento` a partir de uma linha já casada. */
export function montarLancamento(p, versaoId, tipo) {
  return {
    versao_id: versaoId,
    tipo,
    bu_id: p.empresa.bu_id,
    torre_id: p.empresa.torre_id,
    sub_torre_id: p.empresa.sub_torre_id,
    empresa_id: p.empresa.id,
    conta_id: p.conta?.id ?? null,
    descricao: p.descricao || null,
    centro_de_custo: p.centroCusto || null,
    fornecedor: p.fornecedor || null,
    // A marca vai no começo das observações, onde a pessoa vê sem procurar, e
    // guarda o que a planilha dizia — senão o rótulo original se perde.
    obs: [p.falhas?.length ? `⚠ ${p.falhas.join(' · ')}` : '', p.obs].filter(Boolean).join(' | ') || null,
    area: p.area || null,
    pacote: p.pacote || null,
    subpacote: p.subpacote || null,
    aliquota: p.aliquota ?? null,
    taxa_efetiva: p.taxaEfetiva ?? null,
    mes_reajuste: dataDoSerial(p.mesReajuste),
    indice_reajuste: p.indiceReajuste || null,
    // O resto do que a planilha trouxe. Os nomes já vêm no formato do banco,
    // do MAPA_COLUNAS do leitor, e o que não tem coluna própria vai no jsonb.
    ...Object.fromEntries(EXTRA_TEMPLATE.filter((c) => c !== 'extras').map((c) => [c, p[c] ?? null])),
    extras: p.curinga ?? null,
  }
}

/** Monta as 12 linhas de `lancamento_valor_mensal`, com os blocos derivados. */
export function montarValoresMensais(p, lancamentoId) {
  return p.valores.map((v) => {
    const linha = { lancamento_id: lancamentoId, mes: v.mes, valor: v.valor }
    for (const c of EXTRA_MENSAL) if (v[c] !== undefined) linha[c] = v[c]
    return linha
  })
}

/** Tira as colunas que o banco ainda não tem, para o insert não ser recusado. */
export function semColunas(linha, colunas) {
  const copia = { ...linha }
  for (const c of colunas) delete copia[c]
  return copia
}
