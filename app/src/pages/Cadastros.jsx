import { Link } from 'react-router-dom'
import Layout from '../components/Layout'

const ITENS = [
  { label: 'Estrutura Organização', icon: '🗂️', to: '/cadastros/estrutura-organizacional' },
  { label: 'Usuários', icon: '👤', to: '/cadastros/usuarios' },
  { label: 'Contas Contábeis', icon: '📒', to: '/cadastros/contas' },
  { label: 'Centros de Custo', icon: '🏷️', to: '/cadastros/centros-de-custo' },
  { label: 'Diretorias', icon: '🏢', to: '/cadastros/diretorias' },
  { label: 'Operações', icon: '⚙️', to: '/cadastros/operacoes' },
  { label: 'Produtos', icon: '📦', to: '/cadastros/produtos' },
  { label: 'Clientes', icon: '🤝', to: '/cadastros/clientes' },
  { label: 'Fornecedores', icon: '🚚', to: '/cadastros/fornecedores' },
  { label: 'Layouts', icon: '🧩', to: '/cadastros/layouts' },
  { label: 'Índices', icon: '📈', to: '/cadastros/indices' },
]

export default function Cadastros() {
  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Cadastros</h1>
          <p>Ferramenta administrativa do orçamento</p>
        </div>
      </header>

      <div className="content">
        <div className="proto-banner">
          ⓘ Todas as categorias já estão conectadas ao Supabase.
        </div>

        <div className="admin-grid">
          {ITENS.map((item) => (
            <Link key={item.label} to={item.to}>
              <div className="admin-item">
                <div className="admin-item-icon">{item.icon}</div>
                <div className="admin-item-label">{item.label}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  )
}
