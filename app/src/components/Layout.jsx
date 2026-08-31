import { useState } from 'react'
import { NavLink } from 'react-router-dom'

const NAV_SECTIONS = [
  {
    label: 'Visão geral',
    items: [{ to: '/dashboard', icon: '▦', text: 'Dashboard' }],
  },
  {
    label: 'Orçamento',
    items: [
      { to: '/orcamento/receita', icon: '▲', text: '(+) Revenue' },
      { to: '/orcamento/despesa', icon: '▼', text: '(−) Expenses' },
      { to: '/orcamento/capex', icon: '◆', text: '(−) Capex' },
    ],
  },
  {
    label: 'Fluxo',
    items: [{ to: '/aprovacoes', icon: '✓', text: 'Aprovações' }],
  },
  {
    label: 'Análise',
    items: [{ to: '/relatorios', icon: '▤', text: 'Relatórios' }],
  },
  {
    label: 'Administração',
    items: [{ to: '/cadastros', icon: '👤', text: 'Cadastros' }],
  },
  {
    label: 'Budget - Settings',
    items: [
      { to: '/budget-settings', icon: '⚙', text: 'Ciclos & Versões' },
      { to: '/login', icon: '⎋', text: 'Sair' },
    ],
  },
]

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="app-shell">
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-brand">
          <NavLink to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
            <div className="logo-mark">NS</div>
            <div className="brand-text">
              <strong><span className="brand-ns">NS</span> <span className="brand-rest">Budget</span></strong>
              <span>Ferramenta Orçamentária Nstech</span>
            </div>
          </NavLink>
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span> <span className="nav-label">{item.text}</span>
              </NavLink>
            ))}
          </div>
        ))}

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">EN</div>
            <div className="user-meta">
              <strong>Emerson Nakamura</strong>
              <span>NSTECH GR LTDA</span>
            </div>
          </div>
          <div className="sidebar-role-badge">Aprovador</div>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  )
}
