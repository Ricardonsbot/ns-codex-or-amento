import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useToast } from '../components/ToastProvider'

export default function Dashboard() {
  const showToast = useToast()

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Dashboard</h1>
          <p>Ciclo de Orçamento 2026 · Consolidado Corporate</p>
        </div>
      </header>

      <div className="content">
        <div className="proto-banner">
          ⓘ Fase 1 da migração para React — ainda mostrando dados de exemplo, sem conexão real com o Supabase.
        </div>

        <div className="filter-bar">
          <div className="filter-field">
            <label>Ano</label>
            <select><option>2026</option><option>2025</option><option>2024</option></select>
          </div>
          <div className="filter-field">
            <label>BU</label>
            <select><option>Todas as BUs</option><option>Corporate</option><option>PSL</option><option>Embarcador</option></select>
          </div>
          <div className="filter-field">
            <label>Torre</label>
            <select><option>Todas as Torres</option></select>
          </div>
          <div className="filter-field">
            <label>Visão</label>
            <select><option>Corporate (Consolidado)</option><option>Por BU</option><option>Por Torre</option></select>
          </div>
          <button className="btn btn-secondary" onClick={() => showToast('Filtros aplicados (simulado)', 'info')}>
            Aplicar Filtros
          </button>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Resumo do Orçamento — Revenue → EBITDA after Capex</h2>
              <p>Ciclo 2026 · Consolidado Corporate (R$ milhões)</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="bridge-chart">
              <div className="bridge-col">
                <div className="bridge-value">R$ 184,2 mi</div>
                <div className="bridge-track"><div className="bridge-bar receita" style={{ bottom: '0%', height: '100%' }} /></div>
                <div className="bridge-label"><span className="bridge-sign">(+)</span>Revenue</div>
              </div>
              <div className="bridge-connector">
                <div className="bridge-value">&nbsp;</div>
                <div className="bridge-connector-track"><div className="bridge-connector-line" style={{ bottom: '100%' }} /></div>
                <div className="bridge-label">&nbsp;</div>
              </div>
              <div className="bridge-col">
                <div className="bridge-value">− R$ 96,7 mi</div>
                <div className="bridge-track"><div className="bridge-bar despesa" style={{ bottom: '47.5%', height: '52.5%' }} /></div>
                <div className="bridge-label"><span className="bridge-sign">(−)</span>Expenses</div>
              </div>
              <div className="bridge-connector">
                <div className="bridge-value">&nbsp;</div>
                <div className="bridge-connector-track"><div className="bridge-connector-line" style={{ bottom: '47.5%' }} /></div>
                <div className="bridge-label">&nbsp;</div>
              </div>
              <div className="bridge-col">
                <div className="bridge-value">R$ 87,5 mi</div>
                <div className="bridge-track"><div className="bridge-bar subtotal" style={{ bottom: '0%', height: '47.5%' }} /></div>
                <div className="bridge-label">EBITDA</div>
              </div>
              <div className="bridge-connector">
                <div className="bridge-value">&nbsp;</div>
                <div className="bridge-connector-track"><div className="bridge-connector-line" style={{ bottom: '47.5%' }} /></div>
                <div className="bridge-label">&nbsp;</div>
              </div>
              <div className="bridge-col">
                <div className="bridge-value">− R$ 22,5 mi</div>
                <div className="bridge-track"><div className="bridge-bar capex" style={{ bottom: '35.3%', height: '12.2%' }} /></div>
                <div className="bridge-label"><span className="bridge-sign">(−)</span>Capex</div>
              </div>
              <div className="bridge-connector">
                <div className="bridge-value">&nbsp;</div>
                <div className="bridge-connector-track"><div className="bridge-connector-line" style={{ bottom: '35.3%' }} /></div>
                <div className="bridge-label">&nbsp;</div>
              </div>
              <div className="bridge-col">
                <div className="bridge-value">R$ 65,0 mi</div>
                <div className="bridge-track"><div className="bridge-bar final" style={{ bottom: '0%', height: '35.3%' }} /></div>
                <div className="bridge-label">EBITDA after Capex</div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Acesso Rápido</h2>
              <p>Navegue pelas funcionalidades do orçamento sem sair do menu</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="action-strip">
              <Link to="/orcamento/despesa">
                <div className="hub-card hub-inserir">
                  <div className="hub-icon">✎</div>
                  <h3>Inserir</h3>
                  <p>Lançar valores de Receita, Despesa e Capex.</p>
                  <div className="hub-cta">Novo lançamento →</div>
                </div>
              </Link>
              <Link to="/cadastros">
                <div className="hub-card hub-cadastrar">
                  <div className="hub-icon">👤</div>
                  <h3>Cadastrar</h3>
                  <p>Usuários, contas, índices, layouts e mais.</p>
                  <div className="hub-cta">Abrir cadastros →</div>
                </div>
              </Link>
              <div className="hub-card hub-exportar" onClick={() => showToast('Exportação simulada gerada', 'info')}>
                <div className="hub-icon">⭳</div>
                <h3>Exportar</h3>
                <p>Baixar o resumo do orçamento do ciclo atual.</p>
                <div className="hub-cta">Exportar dados →</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
