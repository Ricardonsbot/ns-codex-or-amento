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
export function montarResolvedorDeConta(contas, tipo) {
  const prefixo = PREFIXO_PL[tipo]
  const doTipo = contas.filter((c) => (c.linha_pl || '').startsWith(prefixo))
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
      if (!(achada.linha_pl || '').startsWith(prefixo)) {
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
 *              obrigatório e a BU vem da empresa
 */
export function casar({ tipo, linhas }, { empresas, contas }) {
  const porEmpresa = new Map(empresas.map((e) => [lim(e.nome), e]))
  const acharConta = montarResolvedorDeConta(contas, tipo)

  const prontas = []
  const marcadas = []
  const fora = []
  for (const l of linhas) {
    const empresa = porEmpresa.get(lim(l.empresa))
    const { conta, erro } = acharConta(l.contaCodigo, l.contaRotulo)

    if (!empresa) {
      const motivo = l.empresa ? `Empresa "${l.empresa}" não está cadastrada` : 'Linha sem empresa'
      fora.push({ ...l, falhas: erro ? [motivo, erro] : [motivo] })
    } else if (erro) {
      marcadas.push({ ...l, empresa, conta: null, falhas: [erro] })
    } else {
      prontas.push({ ...l, empresa, conta })
    }
  }
  return { prontas, marcadas, fora, pendentes: fora }
}

/**
 * Colunas acrescentadas pela migração 2026-09-08-blocos-derivados.sql. Ficam
 * listadas aqui porque quem grava precisa saber quais remover enquanto o SQL
 * não tiver sido rodado — sem isso o PostgREST recusa o insert inteiro.
 */
export const EXTRA_LANCAMENTO = ['aliquota', 'taxa_efetiva', 'mes_reajuste', 'indice_reajuste']
/** Da migração 2026-09-09-area-do-pl.sql, probada à parte das de cima. */
export const EXTRA_AREA = ['area']
/** Da migração 2026-09-10-pacote-e-subpacote.sql, também probada à parte. */
export const EXTRA_PACOTE = ['pacote', 'subpacote']
export const EXTRA_MENSAL = ['proporcao', 'valor_ajustado', 'valor_liquido', 'valor_caixa']

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
