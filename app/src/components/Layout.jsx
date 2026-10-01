import { Fragment, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icone from './Icone'
import { useAuth } from './AuthProvider'
import { sair } from '../lib/authData'
import { useToast } from './ToastProvider'
import LogErrosBotao from './LogErrosBotao'
import IdentificadorTela from './IdentificadorTela'

/**
 * O menu em árvore, quantos níveis forem precisos: um nó com `filhos` é um
 * grupo que só expande/recolhe (não navega — igual "Importação" e
 * "Configuração"); um nó sem `filhos` é uma tela de verdade, com `to`.
 *
 * "Importar - Template FP&A" e "Importar - Pacote" apontam para a MESMA
 * rota (GestaoImportacao.jsx é uma tela só, com um interruptor interno de
 * "é o target do pacoteiro?") — o `?modo=pacote` na segunda é o que liga
 * esse interruptor ao entrar, e o que distingue qual das duas fica
 * destacada no menu (ver `ehAtivo` abaixo).
 */
const MENU = [
  {
    id: 'importacao',
    text: 'Importação',
    icone: 'importar',
    filhos: [
      {
        id: 'gestao-documentos',
        text: 'Gestão de Doc',
        icone: 'relatorio',
        filhos: [
          { id: 'importar-template', to: '/gestao-importacao', icone: 'importar', text: 'Template FP&A' },
          { id: 'importar-pacote', to: '/gestao-importacao?modo=pacote', icone: 'pacote', text: 'Template Pacote' },
        ],
      },
      {
        id: 'validacao',
        text: 'Validação',
        icone: 'lupa',
        filhos: [
          { id: 'deep-dive', to: '/deep-dive', icone: 'lupa', text: 'Deep Dive' },
          { id: 'pendencia-cadastros', to: '/pendencia-cadastros', icone: 'pendencia', text: 'Pendências' },
          { id: 'mapping', to: '/mapping', icone: 'target', text: 'Mapping' },
        ],
      },
    ],
  },
  {
    id: 'visao-geral',
    text: 'Visão Geral',
    icone: 'dashboard',
    filhos: [
      { id: 'dashboard', to: '/dashboard', icone: 'dashboard', text: 'Dashboard' },
      { id: 'notes', to: '/notes', icone: 'nota', text: 'Notes' },
      {
        id: 'analise',
        text: 'Análise',
        icone: 'resultado',
        filhos: [
          { id: 'resultado', to: '/resultado', icone: 'resultado', text: 'Resultado' },
          { id: 'relatorios', to: '/relatorios', icone: 'relatorio', text: 'Relatórios' },
        ],
      },
    ],
  },
  // Revenue e Expenses soltos, sem o grupo "Budget" por cima — é tela de
  // verdade, com `to`, direto no primeiro nível.
  { id: 'revenue', to: '/orcamento/receita', icone: 'receita', cor: 'receita', text: 'Revenue' },
  { id: 'expenses', to: '/orcamento/despesa', icone: 'despesa', cor: 'despesa', text: 'Expenses' },
  {
    id: 'configuracao',
    text: 'Configuração',
    icone: 'operacao',
    filhos: [
      { id: 'cadastros', to: '/cadastros', icone: 'cadastros', text: 'Cadastros' },
      { id: 'ciclos', to: '/budget-settings', icone: 'ciclos', text: 'Ciclos & Versões' },
    ],
  },
  // Antigo "Fluxo de Aprovação" > "Aprovações": o grupo some, a folha vira
  // "Fluxo Aprovação" direto no primeiro nível.
  { id: 'fluxo-aprovacao', to: '/aprovacoes', icone: 'aprovacao', text: 'Fluxo Aprovação' },
]

/**
 * Quais grupos o menu guarda fechados, por navegador.
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

/**
 * Se `to` é a tela aberta agora. Rota simples (`/cadastros`) casa com ela e
 * com o que vem depois (`/cadastros/contas`) — é o que mantém "Cadastros"
 * destacado nas sub-telas dele. Rota com `?query` (os dois links que
 * apontam para Gestão de Importação) só casa exata: é o query string que
 * distingue qual dos dois está com o modo ligado.
 */
function ehAtivo(to, pathname, search) {
  const [rota, query] = to.split('?')
  if (pathname !== rota) return pathname.startsWith(`${rota}/`)
  return (search.replace(/^\?/, '') || '') === (query || '')
}

/** Algum descendente (folha) deste nó é a tela aberta agora? */
function temDescendenteAtivo(no, pathname, search) {
  if (no.to) return ehAtivo(no.to, pathname, search)
  return (no.filhos ?? []).some((filho) => temDescendenteAtivo(filho, pathname, search))
}

// Recuo de quem está abaixo do primeiro nível: alinha o ÍCONE do submenu
// (menor que o do nível acima) por baixo do TEXTO do nível acima — é o
// que faz o submenu ficar "recuado", como no modelo, em vez de flutuar
// solto à esquerda.
const RECUO_SEM_ICONE = 34
const RECUO_POR_NIVEL = 14

function NoMenu({ no, profundidade, pathname, search, fechadas, alternar, ultimo }) {
  const primeiroNivel = profundidade === 0
  const recuo = primeiroNivel ? 0 : RECUO_SEM_ICONE + (profundidade - 1) * RECUO_POR_NIVEL
  // Só o último item de cada grupo fecha a linha em curva (o "└"); os do
  // meio ficam com o tronco reto passando por trás (o "├"), como numa
  // árvore de seleção de verdade.
  const classeUltimo = !primeiroNivel && ultimo ? '-ultimo' : ''

  if (!no.filhos) {
    const ativo = ehAtivo(no.to, pathname, search)
    return (
      <Link
        to={no.to}
        className={`nav-item${ativo ? ' active' : ''}${primeiroNivel ? '' : ' nav-item-sub'}${classeUltimo ? ' nav-item-sub-ultimo' : ''}`}
        style={{ paddingLeft: primeiroNivel ? 4 : recuo }}
      >
        {!primeiroNivel && (
          <span className={`nav-icon${no.cor ? ` ${no.cor}` : ''}`}>
            <Icone nome={no.icone} tamanho={14} />
          </span>
        )}
        <span className="nav-label">{no.text}</span>
      </Link>
    )
  }

  const aqui = temDescendenteAtivo(no, pathname, search)
  const aberto = aqui || !fechadas.has(no.id)

  return (
    <div className={`menu-grupo${aberto ? '' : ' fechado'}`}>
      <button
        type="button"
        className={`sidebar-section-label menu-grupo-btn${primeiroNivel ? '' : ' menu-grupo-btn-sub'}${classeUltimo ? ' menu-grupo-btn-sub-ultimo' : ''}`}
        onClick={() => alternar(no.id)}
        aria-expanded={aberto}
        title={aberto ? 'Recolher' : 'Expandir'}
        style={{ paddingLeft: primeiroNivel ? 4 : recuo }}
      >
        {!primeiroNivel && (
          <span className="nav-icon">
            <Icone nome={no.icone} tamanho={14} />
          </span>
        )}
        <span className="nav-label menu-grupo-label">{no.text}</span>
        <span className="secao-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {aberto && (
        <div
          className="menu-filhos"
          style={{ '--linha-recuo': `${RECUO_SEM_ICONE + profundidade * RECUO_POR_NIVEL - 14}px` }}
        >
          {no.filhos.map((filho, indice) => (
            <NoMenu
              key={filho.id}
              no={filho}
              profundidade={profundidade + 1}
              pathname={pathname}
              search={search}
              fechadas={fechadas}
              alternar={alternar}
              ultimo={indice === no.filhos.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [fechadas, setFechadas] = useState(lerFechadas)
  const { pathname, search } = useLocation()
  const { sessao } = useAuth()
  const navigate = useNavigate()
  const showToast = useToast()

  const email = sessao?.user?.email ?? ''
  const iniciais = email ? email.slice(0, 2).toUpperCase() : '—'

  /** Abre ou fecha um grupo do menu, em qualquer nível, e lembra a escolha. */
  function alternar(id) {
    setFechadas((atual) => {
      const nova = new Set(atual)
      if (nova.has(id)) nova.delete(id)
      else nova.add(id)
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
          <Link to="/dashboard" className="sidebar-brand-link">
            <img className="logo-mark" src="/logo-64.png" alt="NS Planner" width="34" height="34" />
            <div className="brand-text">
              <strong><span className="brand-ns">NS</span> <span className="brand-rest">Planner</span></strong>
            </div>
          </Link>
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        {collapsed ? (
          <>
            {/* Recolhida, a barra vira ícone puro: sem o rótulo não há como
                expandir um grupo, então mostra tudo achatado, sem a árvore. */}
            {MENU.flatMap(function achatar(no) {
              return no.filhos ? no.filhos.flatMap(achatar) : [no]
            }).map((folha) => (
              <Link
                key={folha.id}
                to={folha.to}
                className={`nav-item${ehAtivo(folha.to, pathname, search) ? ' active' : ''}`}
              >
                <span className={`nav-icon${folha.cor ? ` ${folha.cor}` : ''}`}>
                  <Icone nome={folha.icone} />
                </span>{' '}
                <span className="nav-label">{folha.text}</span>
              </Link>
            ))}
            <div className="nav-item" onClick={handleSair} style={{ cursor: 'pointer' }}>
              <span className="nav-icon">
                <Icone nome="sair" />
              </span>{' '}
              <span className="nav-label">Sair</span>
            </div>
          </>
        ) : (
          // Expandida, cada categoria de primeiro nível ganha um ícone no
          // "rail" — a coluna fina à esquerda, com uma linha contínua
          // passando por trás — em vez do ícone dentro do próprio botão.
          // O conteúdo (botão + árvore de filhos) fica na coluna da direita.
          <div className="sidebar-rail-grid">
            {MENU.map((no) => (
              <Fragment key={no.id}>
                <div className="sidebar-rail-icone">
                  <Icone nome={no.icone} tamanho={18} />
                </div>
                <div className="sidebar-rail-conteudo">
                  <NoMenu
                    no={no}
                    profundidade={0}
                    pathname={pathname}
                    search={search}
                    fechadas={fechadas}
                    alternar={alternar}
                  />
                </div>
              </Fragment>
            ))}
            <div className="sidebar-rail-icone">
              <Icone nome="sair" tamanho={18} />
            </div>
            <div className="sidebar-rail-conteudo">
              <div className="nav-item" onClick={handleSair} style={{ cursor: 'pointer' }}>
                <span className="nav-label">Sair</span>
              </div>
            </div>
          </div>
        )}

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

      <LogErrosBotao />
      <IdentificadorTela />
    </div>
  )
}
