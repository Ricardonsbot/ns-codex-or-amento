/**
 * O que o arquivo traz, somado: os números do cabeçalho da importação.
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
