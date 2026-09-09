import {
  montarLancamento,
  montarValoresMensais,
  semColunas,
  EXTRA_LANCAMENTO,
  EXTRA_MENSAL,
  EXTRA_AREA,
} from './casarTemplateOrcamento.js'

/**
 * Grava os lançamentos em lote.
 *
 * Antes era uma chamada por lançamento mais outra pelos doze meses dele: as
 * 4.094 linhas da Base Gastos da BRK levavam 19 minutos e 8.188 idas ao
 * servidor. Em lote são ~9 chamadas para os cabeçalhos e ~50 para os meses.
 *
 * O `insert` devolve as linhas na mesma ordem em que foram enviadas — é o
 * RETURNING do Postgres sobre um VALUES múltiplo —, e é isso que liga cada id
 * de volta à sua linha da planilha. Se o tamanho voltar diferente do enviado,
 * a função para: seguir adiante casaria valor mensal com o lançamento errado.
 *
 * Recebe o cliente em vez de importá-lo para servir também ao script de linha
 * de comando, que monta o seu próprio.
 */
const LOTE_CABECALHO = 500
const LOTE_MENSAL = 1000

export async function gravarEmLote(client, linhas, versaoId, tipo, suporte, aoProgredir) {
  const ids = []

  for (let i = 0; i < linhas.length; i += LOTE_CABECALHO) {
    const lote = linhas.slice(i, i + LOTE_CABECALHO).map((p) => {
      let linha = montarLancamento(p, versaoId, tipo)
      if (!suporte.lancamento) linha = semColunas(linha, EXTRA_LANCAMENTO)
      if (!suporte.area) linha = semColunas(linha, EXTRA_AREA)
      return linha
    })

    const { data, error } = await client.from('lancamento').insert(lote).select('id')
    if (error) throw new Error(`gravando lançamentos ${i + 1}–${i + lote.length}: ${error.message}`)
    if (!data || data.length !== lote.length) {
      throw new Error(
        `o banco devolveu ${data?.length ?? 0} id(s) para ${lote.length} lançamento(s) — ` +
          'sem essa correspondência os valores mensais iriam para a linha errada.'
      )
    }
    ids.push(...data.map((x) => x.id))
    aoProgredir?.(ids.length, linhas.length)
  }

  const mensais = []
  linhas.forEach((p, i) => {
    const linha = montarValoresMensais(p, ids[i])
    mensais.push(...(suporte.mensal ? linha : linha.map((m) => semColunas(m, EXTRA_MENSAL))))
  })

  for (let i = 0; i < mensais.length; i += LOTE_MENSAL) {
    const lote = mensais.slice(i, i + LOTE_MENSAL)
    const { error } = await client.from('lancamento_valor_mensal').insert(lote)
    if (error) throw new Error(`gravando valores mensais ${i + 1}–${i + lote.length}: ${error.message}`)
  }

  return ids
}
