import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import Icone from './Icone'
import { useAuth } from './AuthProvider'
import { sair } from '../lib/authData'
import { useToast } from './ToastProvider'

const NAV_SECTIONS = [
  {
    label: 'Visão geral',
    items: [{ to: '/dashboard', icone: 'dashboard', text: 'Dashboard' }],
  },
  {
    label: 'Orçamento',
    items: [
      { to: '/orcamento/receita', icone: 'receita', cor: 'receita', text: '(+) Revenue' },
      { to: '/orcamento/despesa', icone: 'despesa', cor: 'despesa', text: '(−) Expenses' },
      { to: '/orcamento/capex', icone: 'capex', text: '(−) Capex' },
      { to: '/gestao-importacao', icone: 'importar', text: 'Gestão de Importação' },
    ],
  },
  {
    label: 'Fluxo',
    items: [
      { to: '/aprovacoes', icone: 'aprovacao', text: 'Aprovações' },
      { to: '/pendencia-cadastros', icone: 'pendencia', text: 'Pendência de Cadastros' },
    ],
  },
  {
    label: 'Análise',
    items: [
      { to: '/resultado', icone: 'resultado', text: 'Resultado' },
      { to: '/relatorios', icone: 'relatorio', text: 'Relatórios' },
    ],
  },
  {
    label: 'Administração',
    items: [{ to: '/cadastros', icone: 'cadastros', text: 'Cadastros' }],
  },
  {
    label: 'Budget - Settings',
    items: [{ to: '/budget-settings', icone: 'ciclos', text: 'Ciclos & Versões' }],
  },
]

/**
 * Quais seções o menu guarda fechadas, por navegador.
 *
 * É preferência de quem olha, não dado da ferramenta: fica no localStorage e
 * não vai para o banco. Um armazenamento bloqueado não pode derrubar o menu,
 * então toda leitura e escrita é protegida.
 */
const CHAVE_SECOES = 'nsbudget.menu.fechadas'

function lerFechadas() {
  try {
    const bruto = window.localStorage.getItem(CHAVE_SECOES)
    return new Set(bruto ? JSON.parse(bruto) : [])
  } catch {
    return new Set()
  }
}

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [fechadas, setFechadas] = useState(lerFechadas)
  const { pathname } = useLocation()
  const { sessao } = useAuth()
  const navigate = useNavigate()
  const showToast = useToast()

  const email = sessao?.user?.email ?? ''
  const iniciais = email ? email.slice(0, 2).toUpperCase() : '—'

  /** Abre ou fecha uma seção do menu, e lembra da escolha. */
  function alternarSecao(label) {
    setFechadas((atual) => {
      const nova = new Set(atual)
      if (nova.has(label)) nova.delete(label)
      else nova.add(label)
      try {
        window.localStorage.setItem(CHAVE_SECOES, JSON.stringify([...nova]))
      } catch {
        // Sem localStorage a escolha vale só nesta sessão — e tudo bem.
      }
      return nova
    })
  }

  async function handleSair() {
    try {
      await sair()
      navigate('/login')
    } catch (err) {
      showToast(`Erro ao sair: ${err.message}`, 'error')
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-brand">
          <NavLink to="/dashboard" className="sidebar-brand-link">
            <img className="logo-mark" src="/logo-64.png" alt="NS Planner" width="34" height="34" />
            <div className="brand-text">
              <strong><span className="brand-ns">NS</span> <span className="brand-rest">Planner</span></strong>
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

        {NAV_SECTIONS.map((section) => {
          // A seção da página aberta nunca fica fechada: some de vista onde a
          // pessoa está, e o menu passa a mentir sobre onde ela está.
          const aqui = section.items.some((i) => pathname.startsWith(i.to))
          // Com a barra recolhida o rótulo não aparece, e sem ele não há como
          // reabrir a seção: ali tudo fica visível.
          const aberta = collapsed || aqui || !fechadas.has(section.label)
          return (
            <div key={section.label} className={`sidebar-section${aberta ? '' : ' fechada'}`}>
              <button
                type="button"
                className="sidebar-section-label"
                onClick={() => alternarSecao(section.label)}
                aria-expanded={aberta}
                title={aberta ? 'Recolher seção' : 'Expandir seção'}
              >
                {/* Sempre o mesmo triângulo: quem vira é o CSS, pela classe
                    "fechada" da seção. */}
                <span className="secao-chevron" aria-hidden="true">
                  ▾
                </span>
                {section.label}
              </button>
              {aberta &&
                section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  >
                    <span className={`nav-icon${item.cor ? ` ${item.cor}` : ''}`}>
                      <Icone nome={item.icone} />
                    </span>{' '}
                    <span className="nav-label">{item.text}</span>
                  </NavLink>
                ))}
            </div>
          )
        })}

        <div className="sidebar-section-label sidebar-section-label-fixo">Conta</div>
        <div className="nav-item" onClick={handleSair} style={{ cursor: 'pointer' }}>
          <span className="nav-icon">
            <Icone nome="sair" />
          </span>{' '}
          <span className="nav-label">Sair</span>
        </div>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">{iniciais}</div>
            <div className="user-meta">
              <strong>{email || 'Usuário'}</strong>
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
