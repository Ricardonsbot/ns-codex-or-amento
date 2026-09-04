import { supabase } from './supabaseClient'
import { ABA, lim } from './lerTemplateReceita'

export { ABA }

/**
 * Lê a planilha num Web Worker. O parse do template leva dezenas de segundos —
 * são ~9 MB e uma aba de 18 mil linhas — e na thread principal isso congela a
 * tela inteira, sem nem conseguir mostrar "lendo...".
 */
export function lerPlanilhaEmWorker(arrayBuffer) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./receitaTemplate.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      worker.terminate()
      if (e.data.erro) reject(new Error(e.data.erro))
      else resolve(e.data.linhas)
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || 'falha ao ler a planilha em segundo plano'))
    }
    // transfere o buffer em vez de copiar: são 9 MB
    worker.postMessage({ arrayBuffer }, [arrayBuffer])
  })
}

/**
 * Casa cada linha com empresa e conta já cadastradas. Não grava nada — devolve
 * o que resolveu e o que não, para a tela mostrar antes de confirmar.
 */
export async function conferir(linhas) {
  const [emps, contas, ciclos] = await Promise.all([
    supabase.from('empresa').select('id, nome, bu_id, torre_id, sub_torre_id'),
    supabase.from('conta').select('id, codigo, nome, linha_pl'),
    supabase.from('ciclo').select('id, ano, status, versao(id, nome, status)'),
  ])
  for (const x of [emps, contas, ciclos]) if (x.error) throw x.error

  const ciclo = ciclos.data.find((c) => c.status !== 'encerrado')
  const versao = ciclo?.versao?.find((v) => v.status === 'ativa')

  const porEmpresa = new Map(emps.data.map((e) => [lim(e.nome), e]))
  const contasReceita = contas.data.filter((c) => (c.linha_pl || '').startsWith('Receita'))

  // Entre candidatos de mesmo nome fica o de código mais curto: é a conta base,
  // não a sub-conta de provisão ou reversão.
  const acharConta = (rotulo) => {
    const iguais = contasReceita.filter((c) => lim(c.nome) === lim(rotulo))
    if (!iguais.length) return null
    return iguais.sort((a, b) => a.codigo.length - b.codigo.length || a.codigo.localeCompare(b.codigo))[0]
  }

  const prontas = []
  const pendentes = []
  for (const l of linhas) {
    const empresa = porEmpresa.get(lim(l.empresa))
    const conta = acharConta(l.contaRotulo)
    const falhas = []
    if (!empresa) falhas.push(`Empresa "${l.empresa}" não está cadastrada`)
    if (!conta) falhas.push(`"${l.contaRotulo}" não casa com nenhuma conta de receita`)
    if (falhas.length) pendentes.push({ ...l, falhas })
    else prontas.push({ ...l, empresa, conta })
  }

  return { ciclo, versao, prontas, pendentes }
}

/** Grava as linhas já conferidas como lançamentos de receita. */
export async function importar(prontas, versaoId) {
  let criados = 0
  for (const p of prontas) {
    // Produto e cliente não têm coluna em `lancamento`; vão para descrição e
    // obs para não se perderem. Quando a tabela ganhar produto_id/cliente_id,
    // é para lá que devem migrar.
    const descricao = [p.produtoAnalitico || p.produtoSintetico, p.tipoReceita].filter(Boolean).join(' · ')
    const obs = [p.cliente && `Cliente: ${p.cliente}`, p.obs].filter(Boolean).join(' | ')

    const { data, error } = await supabase
      .from('lancamento')
      .insert({
        versao_id: versaoId,
        tipo: 'receita',
        bu_id: p.empresa.bu_id,
        torre_id: p.empresa.torre_id,
        sub_torre_id: p.empresa.sub_torre_id,
        empresa_id: p.empresa.id,
        conta_id: p.conta.id,
        descricao: descricao || null,
        obs: obs || null,
      })
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
