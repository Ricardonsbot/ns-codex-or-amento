/**
 * O que o arquivo traz, somado: os doze meses de cada módulo e os números
 * do cabeçalho da importação.
 *
 * Conta só o que vai entrar — prontas e marcadas. A linha recusada não
 * entra no banco, e somá-la aqui faria o resumo prometer um número que a
 * importação não vai gravar.
 *
 * Puro de propósito, para ser testado sem tela.
 */

const doze = () => Array(12).fill(0)

export function resumoDoUpload(entradas) {
  const porMes = {}
  const totais = {}
  const empresas = new Set()
  const contas = new Set()
  let linhas = 0

  for (const e of entradas ?? []) {
    if (!e?.previa) continue
    const meses = doze()
    for (const p of [...e.previa.prontas, ...e.previa.marcadas]) {
      linhas += 1
      for (const v of p.valores ?? []) {
        const i = (v.mes ?? 0) - 1
        if (i >= 0 && i < 12) meses[i] += Number(v.valor) || 0
      }
      const nome = typeof p.empresa === 'object' ? p.empresa?.nome : p.empresa
      if (nome) empresas.add(String(nome))
      const conta = p.conta?.codigo || p.contaCodigo
      if (conta) contas.add(String(conta).replace(/\D/g, ''))
    }
    porMes[e.tipo] = meses
    totais[e.tipo] = meses.reduce((a, x) => a + x, 0)
  }

  return {
    porMes,
    totais,
    linhas,
    empresas: empresas.size,
    contas: contas.size,
    tipos: Object.keys(porMes),
    total: Object.values(totais).reduce((a, x) => a + x, 0),
  }
}
