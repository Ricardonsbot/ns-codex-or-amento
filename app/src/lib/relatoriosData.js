import { supabase } from './supabaseClient'

function novoNo(nome) {
  return { nome, receita: 0, despesa: 0, capex: 0, filhos: new Map() }
}

function acumular(no, tipo, valor) {
  no[tipo] += valor
}

export async function fetchRelatorio(versaoId) {
  const { data, error } = await supabase
    .from('lancamento')
    .select(
      'tipo, bu_id, bu:bu_id(nome), torre_id, torre:torre_id(nome), sub_torre_id, sub_torre:sub_torre_id(nome), empresa_id, empresa:empresa_id(nome), lancamento_valor_mensal(valor)'
    )
    .eq('versao_id', versaoId)
  if (error) throw error

  const raiz = new Map()

  for (const l of data ?? []) {
    const total = (l.lancamento_valor_mensal ?? []).reduce((acc, v) => acc + Number(v.valor), 0)

    const buKey = l.bu_id ?? 'sem-bu'
    if (!raiz.has(buKey)) raiz.set(buKey, novoNo(l.bu?.nome ?? 'Sem BU'))
    const buNo = raiz.get(buKey)
    acumular(buNo, l.tipo, total)

    const torreKey = l.torre_id ?? 'sem-torre'
    if (!buNo.filhos.has(torreKey)) buNo.filhos.set(torreKey, novoNo(l.torre?.nome ?? 'Sem Torre'))
    const torreNo = buNo.filhos.get(torreKey)
    acumular(torreNo, l.tipo, total)

    const subKey = l.sub_torre_id ?? 'sem-sub'
    if (!torreNo.filhos.has(subKey)) torreNo.filhos.set(subKey, novoNo(l.sub_torre?.nome ?? 'Sem Sub Torre'))
    const subNo = torreNo.filhos.get(subKey)
    acumular(subNo, l.tipo, total)

    const empKey = l.empresa_id ?? 'sem-empresa'
    if (!subNo.filhos.has(empKey)) subNo.filhos.set(empKey, novoNo(l.empresa?.nome ?? 'Sem Empresa'))
    const empNo = subNo.filhos.get(empKey)
    acumular(empNo, l.tipo, total)
  }

  const linhas = []
  const totalGeral = { receita: 0, despesa: 0, capex: 0 }

  for (const buNo of raiz.values()) {
    linhas.push({ nivel: 0, ...semFilhos(buNo) })
    totalGeral.receita += buNo.receita
    totalGeral.despesa += buNo.despesa
    totalGeral.capex += buNo.capex
    for (const torreNo of buNo.filhos.values()) {
      linhas.push({ nivel: 1, ...semFilhos(torreNo) })
      for (const subNo of torreNo.filhos.values()) {
        linhas.push({ nivel: 2, ...semFilhos(subNo) })
        for (const empNo of subNo.filhos.values()) {
          linhas.push({ nivel: 3, ...semFilhos(empNo) })
        }
      }
    }
  }

  return { linhas, totalGeral }
}

function semFilhos(no) {
  const { filhos, ...resto } = no
  return { ...resto, ebitda: resto.receita - resto.despesa }
}
