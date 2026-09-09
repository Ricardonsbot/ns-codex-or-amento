import { supabase } from './supabaseClient'
import { TEMPLATE } from './lerTemplateOrcamento'
import {
  casar,
  montarLancamento,
  montarValoresMensais,
  semColunas,
  EXTRA_LANCAMENTO,
  EXTRA_MENSAL,
  EXTRA_AREA,
} from './casarTemplateOrcamento'

/**
 * Se o banco já tem as colunas dos blocos derivados. Enquanto a migração
 * 2026-09-08 não for rodada elas não existem, e mandá-las faria o PostgREST
 * recusar o insert inteiro — a importação pararia de funcionar por causa de um
 * campo opcional. Pergunta uma vez e guarda.
 */
let suporte = null
export async function colunasDerivadas() {
  if (suporte) return suporte
  // Cada migração é probada à parte: ter rodado uma e não a outra é normal, e
  // agrupar faria perder o campo de quem ja tem a coluna.
  const [a, b, c] = await Promise.all([
    supabase.from('lancamento').select(EXTRA_LANCAMENTO.join(',')).limit(1),
    supabase.from('lancamento_valor_mensal').select(EXTRA_MENSAL.join(',')).limit(1),
    supabase.from('lancamento').select(EXTRA_AREA.join(',')).limit(1),
  ])
  suporte = { lancamento: !a.error, mensal: !b.error, area: !c.error }
  return suporte
}

export { TEMPLATE }

/**
 * Lê a planilha num Web Worker. O parse do template leva dezenas de segundos —
 * são ~9 MB e abas de milhares de linhas — e na thread principal isso congela a
 * tela inteira, sem nem conseguir mostrar "lendo...".
 */
export function lerPlanilhaEmWorker(arrayBuffer, tipo) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./orcamentoTemplate.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      worker.terminate()
      if (e.data.erro) reject(new Error(e.data.erro))
      else resolve(e.data.resultado)
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || 'falha ao ler a planilha em segundo plano'))
    }
    // transfere o buffer em vez de copiar: são 9 MB
    worker.postMessage({ arrayBuffer, tipo }, [arrayBuffer])
  })
}

/**
 * Casa cada linha com empresa e conta já cadastradas. Não grava nada — devolve
 * o que resolveu e o que não, para a tela mostrar antes de confirmar.
 *
 * Devolve também quantos lançamentos deste tipo a versão já tem. Sem isso,
 * importar o mesmo arquivo duas vezes dobra o orçamento em silêncio: a
 * gravação só insere, não procura o que já está lá.
 */
export async function conferir(lido) {
  // A hierarquia vem junto porque a conferência mostra o Painel Resultado antes
  // de gravar, e ali as linhas precisam do NOME da BU, da torre e da sub torre —
  // a empresa só guarda os ids.
  const [emps, contas, ciclos, bus, torres, subs] = await Promise.all([
    supabase.from('empresa').select('id, nome, bu_id, torre_id, sub_torre_id'),
    supabase.from('conta').select('id, codigo, nome, linha_pl'),
    supabase.from('ciclo').select('id, ano, status, versao(id, nome, status)'),
    supabase.from('bu').select('id, nome'),
    supabase.from('torre').select('id, nome'),
    supabase.from('sub_torre').select('id, nome'),
  ])
  for (const x of [emps, contas, ciclos, bus, torres, subs]) if (x.error) throw x.error

  const nomeDe = (lista) => new Map(lista.map((x) => [x.id, x.nome]))
  const hierarquia = { bu: nomeDe(bus.data), torre: nomeDe(torres.data), sub: nomeDe(subs.data) }

  const ciclo = ciclos.data.find((c) => c.status !== 'encerrado')
  const versao = ciclo?.versao?.find((v) => v.status === 'ativa')

  let jaExistem = 0
  if (versao) {
    const { count, error } = await supabase
      .from('lancamento')
      .select('*', { count: 'exact', head: true })
      .eq('versao_id', versao.id)
      .eq('tipo', lido.tipo)
    if (error) throw error
    jaExistem = count ?? 0
  }

  return {
    ciclo,
    versao,
    jaExistem,
    hierarquia,
    ...casar(lido, { empresas: emps.data, contas: contas.data }),
  }
}

/**
 * Apaga os lançamentos deste tipo na versão, para quando a importação
 * substitui em vez de somar. Os valores mensais vão junto pelo ON DELETE
 * CASCADE da tabela.
 */
export async function apagarDoTipo(versaoId, tipo) {
  const { data, error } = await supabase
    .from('lancamento')
    .delete()
    .eq('versao_id', versaoId)
    .eq('tipo', tipo)
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

/**
 * Grava as linhas já conferidas como lançamentos.
 *
 * Devolve os ids criados para a tela poder oferecer um desfazer: subir o
 * arquivo errado é fácil, e sem isso a correção é apagar linha por linha.
 */
export async function importar(prontas, versaoId, tipo) {
  const sup = await colunasDerivadas()
  const ids = []
  for (const p of prontas) {
    let linha = montarLancamento(p, versaoId, tipo)
    if (!sup.lancamento) linha = semColunas(linha, EXTRA_LANCAMENTO)
    if (!sup.area) linha = semColunas(linha, EXTRA_AREA)
    const { data, error } = await supabase
      .from('lancamento')
      .insert(linha)
      .select('id')
      .single()
    if (error) throw new Error(`linha ${p.linha}: ${error.message}`)

    const mensais = montarValoresMensais(p, data.id)
    const { error: erroMes } = await supabase
      .from('lancamento_valor_mensal')
      .insert(sup.mensal ? mensais : mensais.map((m) => semColunas(m, EXTRA_MENSAL)))
    if (erroMes) throw new Error(`linha ${p.linha}, valores mensais: ${erroMes.message}`)

    ids.push(data.id)
  }
  return ids
}

/**
 * Desfaz uma importação, apagando exatamente os lançamentos que ela criou.
 * Diferente da substituição, não toca em mais nada da versão.
 */
export async function desfazer(ids) {
  if (!ids?.length) return 0
  const { data, error } = await supabase.from('lancamento').delete().in('id', ids).select('id')
  if (error) throw error
  return data?.length ?? 0
}
