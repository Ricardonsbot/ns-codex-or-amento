import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { exportarExcel } from '../../lib/excelUtils'
import { nomeArquivoExportacao, MODULOS } from '../../lib/modulos'
import dados from '../../data/aliquotas.json'

const TRIBUTOS = [
  { chave: 'iss', rotulo: 'ISS' },
  { chave: 'pis', rotulo: 'PIS' },
  { chave: 'cofins', rotulo: 'COFINS' },
  { chave: 'icms', rotulo: 'ICMS' },
  { chave: 'cprb', rotulo: 'CPRB' },
  { chave: 'iva', rotulo: 'IVA' },
]

const pct = (v) =>
  v === null || v === undefined
    ? '—'
    : `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

export default function Aliquotas() {
  const [bu, setBu] = useState('')
  const [busca, setBusca] = useState('')

  const bus = useMemo(() => [...new Set(dados.registros.map((r) => r.bu))].sort(), [])

  const linhas = useMemo(() => {
    const alvo = busca.trim().toLowerCase()
    return dados.registros
      .filter((r) => !bu || r.bu === bu)
      .filter((r) => !alvo || `${r.empresa} ${r.produto}`.toLowerCase().includes(alvo))
      .sort((a, b) => a.empresa.localeCompare(b.empresa) || a.produto.localeCompare(b.produto))
  }, [bu, busca])

  function handleExportar() {
    const colunas = [
      { key: 'BU' }, { key: 'Torre' }, { key: 'Subtorre' }, { key: 'Empresa' }, { key: 'Produto' },
      ...TRIBUTOS.map((t) => ({ key: t.rotulo })), { key: 'Consolidado' }, { key: 'Total' },
    ]
    const corpo = linhas.map((r) => ({
      BU: r.bu, Torre: r.torre, Subtorre: r.subtorre, Empresa: r.empresa, Produto: r.produto,
      ...Object.fromEntries(TRIBUTOS.map((t) => [t.rotulo, r[t.chave] ?? ''])),
      Consolidado: r.consolidado ?? '', Total: r.total ?? '',
    }))
    exportarExcel(nomeArquivoExportacao(MODULOS.CADASTROS, 'Aliquotas'), corpo, colunas)
  }

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Alíquotas</h1>
          <p>Alíquota efetiva sobre receita, por empresa e produto</p>
        </div>
        <Link className="btn btn-secondary btn-sm" to="/cadastros">← Voltar aos Cadastros</Link>
      </header>

      <div className="content">
        <div className="proto-banner">
          ⓘ PSL e Embarcador usam métodos diferentes: em Embarcador a alíquota vem aberta por tributo;
          em PSL vem consolidada. A coluna Total é a efetiva nos dois casos, e é ela que dá para comparar.
        </div>

        <div className="filter-bar">
          <div className="filter-field">
            <label>BU</label>
            <select value={bu} onChange={(e) => setBu(e.target.value)}>
              <option value="">Todas as BUs</option>
              {bus.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label>Buscar</label>
            <input
              type="text"
              value={busca}
              placeholder="empresa ou produto"
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <span className="text-muted">{linhas.length} de {dados.registros.length}</span>
          <button className="btn btn-secondary btn-sm" type="button" onClick={handleExportar} style={{ marginLeft: 'auto' }}>
            ⭳ Exportar
          </button>
        </div>

        <div className="panel">
          <div className="panel-body">
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>EMPRESA</th>
                    <th>PRODUTO</th>
                    <th>BU · TORRE</th>
                    {TRIBUTOS.map((t) => (
                      <th key={t.chave} className="text-right">{t.rotulo}</th>
                    ))}
                    <th className="text-right">CONSOLIDADO</th>
                    <th className="text-right">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((r, i) => (
                    <tr key={i}>
                      <td><strong>{r.empresa}</strong></td>
                      <td>{r.produto}</td>
                      <td style={{ fontSize: 12, opacity: 0.75 }}>{r.bu} · {r.torre}</td>
                      {TRIBUTOS.map((t) => (
                        <td key={t.chave} className="text-right">{pct(r[t.chave])}</td>
                      ))}
                      <td className="text-right">{pct(r.consolidado)}</td>
                      <td className="text-right"><strong>{pct(r.total)}</strong></td>
                    </tr>
                  ))}
                  {!linhas.length && (
                    <tr>
                      <td colSpan={10}>Nenhuma linha para este filtro.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
