/**
 * Os números de um arquivo de template: o que ele traz somado, e as três
 * medidas que encabeçam a importação.
 *
 * Conta só o que vai entrar — prontas e marcadas. A linha recusada não
 * entra no banco, e somá-la aqui faria o resumo prometer um número que a
 * importação não vai gravar.
 *
 * Puro de propósito, para ser testado sem tela.
 */

export function resumoDoUpload(entradas) {
  const totais = {}
  const empresas = new Set()
  const contas = new Set()
  let linhas = 0

  for (const e of entradas ?? []) {
    if (!e?.previa) continue
    let total = 0
    for (const p of [...e.previa.prontas, ...e.previa.marcadas]) {
      linhas += 1
      for (const v of p.valores ?? []) {
        const mes = v.mes ?? 0
        if (mes >= 1 && mes <= 12) total += Number(v.valor) || 0
      }
      const nome = typeof p.empresa === 'object' ? p.empresa?.nome : p.empresa
      if (nome) empresas.add(String(nome))
      const conta = p.conta?.codigo || p.contaCodigo
      if (conta) contas.add(String(conta).replace(/\D/g, ''))
    }
    totais[e.tipo] = total
  }

  return {
    totais,
    linhas,
    empresas: empresas.size,
    empresasLista: [...empresas].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    contas: contas.size,
    tipos: Object.keys(totais),
    total: Object.values(totais).reduce((a, x) => a + x, 0),
  }
}

/**
 * EBITDA After Capex do que o arquivo traz: Net Revenue menos o gasto
 * menos o capex.
 *
 * Aqui se subtrai porque neste lado da ferramenta gasto é positivo (ver
 * `resumirLinhas`). No P&L completo, em demonstrativo.js, a conta é a
 * mesma com o sinal do outro lado — lá o gasto já chega negativo e se
 * soma. Duas escritas da mesma linha, e é por isso que esta mora num
 * lugar só: o dia em que divergirem, divergem na tela de alguém.
 *
 * É o EAC DESTE ARQUIVO, não o da empresa. O que o template não traz não
 * está aqui — um arquivo só de gastos devolve um EAC negativo, e está
 * certo: é o que aquele arquivo faz com o resultado.
 */
export const ebitdaAfterCapex = ({ nr = 0, despesa = 0, capex = 0 } = {}) => nr - despesa - capex

/**
 * Os três números de cabeçalho do arquivo: Net Revenue, Expenses e EBITDA
 * After Capex.
 *
 * São esses porque são a leitura do negócio. Contagem de linha, de
 * empresa e de conta é encanação — diz que o arquivo chegou, não o que ele
 * faz com o resultado — e continua logo abaixo, na conferência. Capex
 * também saiu de caixa própria: ele está dentro do EAC, que é justamente
 * onde ele muda a decisão de alguém.
 *
 * O percentual é sobre a receita do próprio arquivo; sem receita no
 * arquivo não há denominador, e aí não aparece percentual nenhum.
 */
export function bigNumbersDoArquivo(resumo) {
  const nr = resumo.totais.receita ?? 0
  const despesa = resumo.totais.despesa ?? 0
  const capex = resumo.totais.capex ?? 0
  const eac = ebitdaAfterCapex({ nr, despesa, capex })
  const pct = (v) => (nr ? (v / nr) * 100 : null)
  return [
    { chave: 'nr', rotulo: '(+) Net Revenue', valor: nr },
    { chave: 'despesa', rotulo: '(−) Expenses', valor: despesa, pct: pct(despesa) },
    { chave: 'eac', rotulo: '= EBITDA After Capex', valor: eac, pct: pct(eac) },
  ]
}
