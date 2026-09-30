import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import Icone from './Icone'
import { useAuth } from './AuthProvider'
import { sair } from '../lib/authData'
import { useToast } from './ToastProvider'

/**
 * O menu em duas camadas: `categoria` é o rótulo que agrupa e recolhe
 * (Visão Geral, Orçamento, Fluxo, Análise, Configuração); `modulos` é cada
 * tela clicável dentro dela. "Configuração" junta o que antes eram duas
 * categorias (Administração e Budget - Settings) — Cadastros e Ciclos &
 * Versões são os dois módulos que aparecem em drilldown abaixo dela, do
 * mesmo jeito que qualquer outra categoria já expande.
 */
const CATEGORIAS_MENU = [
  {
    categoria: 'Visão Geral',
    modulos: [{ to: '/dashboard', icone: 'dashboard', text: 'Dashboard' }],
  },
  {
    categoria: 'Notes',
    modulos: [{ to: '/notes', icone: 'nota', text: 'Notes' }],
  },
  {
    categoria: 'Orçamento',
    modulos: [
      { to: '/orcamento/receita', icone: 'receita', cor: 'receita', text: '(+) Revenue' },
      { to: '/orcamento/despesa', icone: 'despesa', cor: 'despesa', text: '(−) Expenses' },
      { to: '/orcamento/capex', icone: 'capex', text: '(−) Capex' },
      { to: '/gestao-importacao', icone: 'importar', text: 'Gestão de Importação' },
    ],
  },
  {
    categoria: 'Fluxo',
    modulos: [
      { to: '/aprovacoes', icone: 'aprovacao', text: 'Aprovações' },
      { to: '/pendencia-cadastros', icone: 'pendencia', text: 'Pendência de Cadastros' },
    ],
  },
  {
    categoria: 'Análise',
    modulos: [
      { to: '/resultado', icone: 'resultado', text: 'Resultado' },
      { to: '/deep-dive', icone: 'lupa', text: 'Deep Dive' },
      { to: '/relatorios', icone: 'relatorio', text: 'Relatórios' },
    ],
  },
  {
    categoria: 'Configuração',
    modulos: [
      { to: '/cadastros', icone: 'cadastros', text: 'Cadastros' },
      { to: '/budget-settings', icone: 'ciclos', text: 'Ciclos & Versões' },
    ],
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

  /** Abre ou fecha uma categoria do menu, e lembra da escolha. */
  function alternarSecao(categoria) {
    setFechadas((atual) => {
      const nova = new Set(atual)
      if (nova.has(categoria)) nova.delete(categoria)
      else nova.add(categoria)
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

        {CATEGORIAS_MENU.map((secao) => {
          // A categoria da página aberta nunca fica fechada: some de vista
          // onde a pessoa está, e o menu passa a mentir sobre onde ela está.
          const aqui = secao.modulos.some((m) => pathname.startsWith(m.to))
          // Com a barra recolhida o rótulo não aparece, e sem ele não há como
          // reabrir a categoria: ali tudo fica visível.
          const aberta = collapsed || aqui || !fechadas.has(secao.categoria)
          return (
            <div key={secao.categoria} className={`sidebar-section${aberta ? '' : ' fechada'}`}>
              <button
                type="button"
                className="sidebar-section-label"
                onClick={() => alternarSecao(secao.categoria)}
                aria-expanded={aberta}
                title={aberta ? 'Recolher categoria' : 'Expandir categoria'}
              >
                {/* Sempre o mesmo triângulo: quem vira é o CSS, pela classe
                    "fechada" da categoria. */}
                <span className="secao-chevron" aria-hidden="true">
                  ▾
                </span>
                {secao.categoria}
              </button>
              {aberta &&
                secao.modulos.map((modulo) => (
                  <NavLink
                    key={modulo.to}
                    to={modulo.to}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  >
                    <span className={`nav-icon${modulo.cor ? ` ${modulo.cor}` : ''}`}>
                      <Icone nome={modulo.icone} />
                    </span>{' '}
                    <span className="nav-label">{modulo.text}</span>
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
