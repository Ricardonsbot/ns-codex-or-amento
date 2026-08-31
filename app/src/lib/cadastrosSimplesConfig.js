export const CADASTROS_SIMPLES = {
  usuarios: {
    titulo: 'Usuários',
    tabela: 'usuario',
    campos: [
      { key: 'nome', label: 'Nome', obrigatorio: true },
      { key: 'email', label: 'E-mail', obrigatorio: true },
      { key: 'papel', label: 'Papel', tipo: 'select', opcoes: ['Admin', 'Aprovador', 'Analista'] },
    ],
  },
  'centros-de-custo': {
    titulo: 'Centros de Custo',
    tabela: 'centro_de_custo',
    campos: [
      { key: 'codigo', label: 'Código', obrigatorio: true },
      { key: 'nome', label: 'Nome', obrigatorio: true },
    ],
  },
  diretorias: {
    titulo: 'Diretorias',
    tabela: 'diretoria',
    campos: [
      { key: 'nome', label: 'Nome', obrigatorio: true },
      { key: 'responsavel', label: 'Responsável' },
    ],
  },
  operacoes: {
    titulo: 'Operações',
    tabela: 'operacao',
    campos: [
      { key: 'nome', label: 'Nome', obrigatorio: true },
      { key: 'descricao', label: 'Descrição' },
    ],
  },
  produtos: {
    titulo: 'Produtos',
    tabela: 'produto',
    campos: [
      { key: 'codigo', label: 'Código', obrigatorio: true },
      { key: 'nome', label: 'Nome', obrigatorio: true },
      { key: 'categoria', label: 'Categoria' },
    ],
  },
  clientes: {
    titulo: 'Clientes',
    tabela: 'cliente',
    campos: [
      { key: 'nome', label: 'Nome', obrigatorio: true },
      { key: 'documento', label: 'CNPJ/CPF' },
      { key: 'contato', label: 'Contato' },
    ],
  },
  fornecedores: {
    titulo: 'Fornecedores',
    tabela: 'fornecedor',
    campos: [
      { key: 'nome', label: 'Nome', obrigatorio: true },
      { key: 'documento', label: 'CNPJ/CPF' },
      { key: 'contato', label: 'Contato' },
    ],
  },
  layouts: {
    titulo: 'Layouts',
    tabela: 'layout',
    campos: [
      { key: 'nome', label: 'Nome', obrigatorio: true },
      { key: 'tipo', label: 'Tipo' },
      { key: 'descricao', label: 'Descrição' },
    ],
  },
}
