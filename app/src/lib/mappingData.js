import { supabase } from './supabaseClient'

/**
 * O Mapping é por EMPRESA: para o ciclo/versão escolhido, cada empresa
 * cadastrada ganha uma cor conforme o que a importação já sabe sobre ela —
 * não inventa um status novo, só reaproveita `importacao.liberacao` (o
 * mesmo campo que o histórico de importação usa) e agrega por empresa,
 * porque um arquivo cobre várias de uma vez.
 *
 *   cinza    nenhuma importação deste ciclo/versão inclui a empresa
 *   amarelo  incluída, e a importação mais recente dela foi devolvida
 *   azul     incluída, aguardando alguém liberar
 *   verde    incluída, já liberada para consolidar
 */
export const CORES_MAPPING = {
  cinza: { rotulo: 'Não subiu', classe: 'cinza' },
  amarelo: { rotulo: 'Devolvido / pendência', classe: 'amarelo' },
  azul: { rotulo: 'Aguardando aprovação', classe: 'azul' },
  verde: { rotulo: 'Liberado para consolidar', classe: 'verde' },
}

const CORES_POR_LIBERACAO = {
  aguardando: 'azul',
  liberado: 'verde',
  devolvido: 'amarelo',
}

export async function fetchMappingEmpresas(versaoId) {
  const [empresasRes, importacoesRes] = await Promise.all([
    supabase.from('empresa').select('id, nome, bu_id').order('nome'),
    supabase
      .from('importacao')
      .select('id, empresas, liberacao, criado_em, atualizado_em')
      .eq('versao_id', versaoId),
  ])
  if (empresasRes.error) throw empresasRes.error
  if (importacoesRes.error) throw importacoesRes.error

  // Mais recente primeiro: a última importação que tocou a empresa é que
  // decide a cor dela, não a primeira.
  const importacoes = [...(importacoesRes.data ?? [])].sort(
    (a, b) => new Date(b.atualizado_em ?? b.criado_em) - new Date(a.atualizado_em ?? a.criado_em)
  )

  const statusPorEmpresa = new Map()
  for (const imp of importacoes) {
    for (const e of imp.empresas ?? []) {
      if (statusPorEmpresa.has(e.id)) continue
      statusPorEmpresa.set(e.id, { liberacao: imp.liberacao ?? 'aguardando', importacaoId: imp.id })
    }
  }

  return (empresasRes.data ?? []).map((empresa) => {
    const status = statusPorEmpresa.get(empresa.id)
    const cor = status ? CORES_POR_LIBERACAO[status.liberacao] ?? 'azul' : 'cinza'
    return { empresa, cor, liberacao: status?.liberacao ?? null, importacaoId: status?.importacaoId ?? null }
  })
}
