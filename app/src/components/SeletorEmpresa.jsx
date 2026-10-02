import { useMemo } from 'react'

/**
 * Empresa em caixa de seleção, agrupada por torre — como no painel de P&L que
 * o time já usa.
 *
 * BU e Torre continuam em botões: são poucas e servem de recorte rápido. A
 * empresa passa de 50 opções, e ali a fila de botões virava um "+ 50" que
 * escondia quase tudo. Na caixa dá para digitar as primeiras letras, e o
 * grupo diz de qual torre é cada uma.
 */
export default function SeletorEmpresa({ empresas, torres, valor, onChange, label = 'Empresa', rotuloTodas = 'Consolidado' }) {
  const grupos = useMemo(() => {
    const nomeTorre = new Map((torres ?? []).map((t) => [t.id, t.nome]))
    const mapa = new Map()
    for (const e of empresas ?? []) {
      const chave = nomeTorre.get(e.torre_id) ?? 'Sem torre'
      if (!mapa.has(chave)) mapa.set(chave, [])
      mapa.get(chave).push(e)
    }
    return [...mapa.entries()]
      .map(([torre, lista]) => [torre, [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))])
      .sort((a, b) => (a[0] === 'Sem torre' ? 1 : b[0] === 'Sem torre' ? -1 : a[0].localeCompare(b[0], 'pt-BR')))
  }, [empresas, torres])

  return (
    <div className="filter-field filtro-empresa">
      <label htmlFor="seletor-empresa">{label}</label>
      <select id="seletor-empresa" value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">
          {rotuloTodas} ({(empresas ?? []).length})
        </option>
        {grupos.map(([torre, lista]) => (
          <optgroup key={torre} label={torre}>
            {lista.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
