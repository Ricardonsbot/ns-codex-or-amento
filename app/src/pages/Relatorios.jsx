import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useToast } from '../components/ToastProvider'
import { fetchVersaoAtual } from '../lib/lancamentosData'
import { fetchRelatorio } from '../lib/relatoriosData'
import { formatMi } from '../lib/dashboardData'

const CLASSE_NIVEL = ['report-bu-row', 'report-torre-row', 'report-subtorre-row', 'report-empresa-row']

export default function Relatorios() {
  const showToast = useToast()
  const [versaoAtual, setVersaoAtual] = useState(null)
  const [linhas, setLinhas] = useState([])
  const [totalGeral, setTotalGeral] = useState({ receita: 0, despesa: 0, capex: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)
    try {
      const va = await fetchVersaoAtual()
      setVersaoAtual(va)
      if (va?.versao) {
        const { linhas, totalGeral } = await fetchRelatorio(va.versao.id)
        setLinhas(linhas)
        setTotalGeral(totalGeral)
      }
    } catch (err) {
      showToast(`Erro ao carregar relatório: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const ebitdaGeral = totalGeral.receita - totalGeral.despesa

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Relatórios</h1>
          <p>Estrutura BU → Torre → Sub Torre → Empresa — dados reais do Supabase (R$)</p>
        </div>
      </header>

      <div className="content">
        {!loading && versaoAtual?.versao && (
          <div className="proto-banner">
            ⓘ Ciclo {versaoAtual.ciclo.ano} · {versaoAtual.versao.nome} — soma de todos os lançamentos (Receita, Despesa, Capex) dessa versão.
          </div>
        )}

        {!loading && !versaoAtual?.versao && (
          <div className="empty-hint">Nenhum ciclo com versão ativa encontrado. Configure um em Budget - Settings.</div>
        )}

        {versaoAtual?.versao && (
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Receita, Despesa, Capex e EBITDA por estrutura</h2>
                <p>{loading ? 'Carregando…' : `${linhas.length} linha(s)`}</p>
              </div>
            </div>
            <div className="panel-body table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Estrutura</th>
                    <th className="text-right">Receita</th>
                    <th className="text-right">Despesa</th>
                    <th className="text-right">Capex</th>
                    <th className="text-right">EBITDA</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha, i) => (
                    <tr key={i} className={CLASSE_NIVEL[linha.nivel]}>
                      <td>{linha.nome}</td>
                      <td className="text-right">{formatMi(linha.receita / 1_000_000)}</td>
                      <td className="text-right">{formatMi(linha.despesa / 1_000_000)}</td>
                      <td className="text-right">{formatMi(linha.capex / 1_000_000)}</td>
                      <td className={`text-right ${linha.ebitda >= 0 ? 'up' : 'down'}`}>{formatMi(linha.ebitda / 1_000_000)}</td>
                    </tr>
                  ))}
                  {!loading && linhas.length === 0 && (
                    <tr>
                      <td colSpan={5} className="empty-hint">Nenhum lançamento nessa versão ainda.</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total Geral</td>
                    <td className="text-right">{formatMi(totalGeral.receita / 1_000_000)}</td>
                    <td className="text-right">{formatMi(totalGeral.despesa / 1_000_000)}</td>
                    <td className="text-right">{formatMi(totalGeral.capex / 1_000_000)}</td>
                    <td className={ebitdaGeral >= 0 ? 'up' : 'down'} style={{ textAlign: 'right' }}>{formatMi(ebitdaGeral / 1_000_000)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
