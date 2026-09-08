import { supabase } from './supabaseClient'
import { TEMPLATE } from './lerTemplateOrcamento'
import { casar, montarLancamento } from './casarTemplateOrcamento'

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
  const [emps, contas, ciclos] = await Promise.all([
    supabase.from('empresa').select('id, nome, bu_id, torre_id, sub_torre_id'),
    supabase.from('conta').select('id, codigo, nome, linha_pl'),
    supabase.from('ciclo').select('id, ano, status, versao(id, nome, status)'),
  ])
  for (const x of [emps, contas, ciclos]) if (x.error) throw x.error

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

  return { ciclo, versao, jaExistem, ...casar(lido, { empresas: emps.data, contas: contas.data }) }
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

/** Grava as linhas já conferidas como lançamentos. */
export async function importar(prontas, versaoId, tipo) {
  let criados = 0
  for (const p of prontas) {
    const { data, error } = await supabase
      .from('lancamento')
      .insert(montarLancamento(p, versaoId, tipo))
      .select('id')
      .single()
    if (error) throw new Error(`linha ${p.linha}: ${error.message}`)

    const { error: erroMes } = await supabase
      .from('lancamento_valor_mensal')
      .insert(p.valores.map((v) => ({ lancamento_id: data.id, mes: v.mes, valor: v.valor })))
    if (erroMes) throw new Error(`linha ${p.linha}, valores mensais: ${erroMes.message}`)

    criados += 1
  }
  return criados
}
