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

/** Separa o que já dá para gravar do que precisa de cadastro antes. */
export function casar({ tipo, linhas }, { empresas, contas }) {
  const porEmpresa = new Map(empresas.map((e) => [lim(e.nome), e]))
  const acharConta = montarResolvedorDeConta(contas, tipo)

  const prontas = []
  const pendentes = []
  for (const l of linhas) {
    const empresa = porEmpresa.get(lim(l.empresa))
    const { conta, erro } = acharConta(l.contaCodigo, l.contaRotulo)
    const falhas = []
    if (!empresa) falhas.push(l.empresa ? `Empresa "${l.empresa}" não está cadastrada` : 'Linha sem empresa')
    if (erro) falhas.push(erro)
    if (falhas.length) pendentes.push({ ...l, falhas })
    else prontas.push({ ...l, empresa, conta })
  }
  return { prontas, pendentes }
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
    conta_id: p.conta.id,
    descricao: p.descricao || null,
    centro_de_custo: p.centroCusto || null,
    fornecedor: p.fornecedor || null,
    obs: p.obs || null,
  }
}
