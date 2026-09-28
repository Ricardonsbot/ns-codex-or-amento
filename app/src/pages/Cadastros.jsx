import { Link } from 'react-router-dom'
import Icone from '../components/Icone'
import Layout from '../components/Layout'

const ITENS = [
  { label: 'Estrutura Organização', icone: 'empresa', to: '/cadastros/estrutura-organizacional' },
  { label: 'Usuários', icone: 'usuario', to: '/cadastros/usuarios' },
  { label: 'Contas Contábeis', icone: 'contas', to: '/cadastros/contas' },
  { label: 'Centros de Custo', icone: 'centroCusto', to: '/cadastros/centros-de-custo' },
  { label: 'Pacotes', icone: 'pacote', to: '/cadastros/pacotes' },
  { label: 'Subpacotes', icone: 'subpacote', to: '/cadastros/subpacotes' },
  { label: 'Targets por Pacote', icone: 'target', to: '/cadastros/targets-pacote' },
  { label: 'Diretorias', icone: 'diretoria', to: '/cadastros/diretorias' },
  { label: 'Operações', icone: 'operacao', to: '/cadastros/operacoes' },
  { label: 'Produtos', icone: 'produto', to: '/cadastros/produtos' },
  { label: 'Clientes', icone: 'cliente', to: '/cadastros/clientes' },
  { label: 'Fornecedores', icone: 'fornecedor', to: '/cadastros/fornecedores' },
  { label: 'Grupos de Fornecedor', icone: 'grupo', to: '/cadastros/grupos-de-fornecedor' },
  { label: 'Layouts', icone: 'layout', to: '/cadastros/layouts' },
  { label: 'Índices', icone: 'indice', to: '/cadastros/indices' },
  { label: 'Premissas Macro', icone: 'premissa', to: '/cadastros/premissas-macro' },
  { label: 'Alçadas de Aprovação', icone: 'alcada', to: '/cadastros/alcadas-aprovacao' },
  { label: 'Alíquotas', icone: 'aliquota', to: '/cadastros/aliquotas' },
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
                <div className="admin-item-icon">
                  <Icone nome={item.icone} tamanho={22} />
                </div>
                <div className="admin-item-label">{item.label}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  )
}
