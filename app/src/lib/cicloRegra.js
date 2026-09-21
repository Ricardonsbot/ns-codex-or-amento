/**
 * Regras de ciclo (ano) e versão que a tela e os scripts dividem. Módulo puro,
 * sem banco: quem chama já trouxe `ciclo.versao` com id, nome, tipo, status e
 * criada_em.
 */

/**
 * A versão que representa o ciclo: a ativa; sem ela, a Original; sem ela, a
 * primeira criada. É para onde a importação grava e o que o Resultado usa
 * como Actual do ano e como Last Year do ano seguinte.
 */
export function versaoReferencia(ciclo) {
  const vs = [...(ciclo?.versao ?? [])].sort((a, b) => String(a.criada_em).localeCompare(String(b.criada_em)))
  return vs.find((v) => v.status === 'ativa') ?? vs.find((v) => v.tipo === 'original') ?? vs[0] ?? null
}

/**
 * O ciclo de destino de um template: o do ANO DO CABEÇALHO da planilha. É o
 * que deixa subir o budget de outros anos sem tocar no ano em elaboração —
 * o template de 2025 vai para o ciclo 2025, o de 2027 para o 2027.
 */
export function cicloDoAno(ciclos, ano) {
  return (ciclos ?? []).find((c) => c.ano === ano) ?? null
}
