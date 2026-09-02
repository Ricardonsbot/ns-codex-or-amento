export const CADASTROS_SIMPLES = {
  usuarios: {
    titulo: 'Usuários',
    tabela: 'usuario',
    tela: 'Usuario',
    campos: [
      { key: 'nome', label: 'Nome', obrigatorio: true },
      { key: 'email', label: 'E-mail', obrigatorio: true },
      { key: 'papel', label: 'Papel', tipo: 'select', opcoes: ['Admin', 'Aprovador', 'Analista'] },
    ],
  },
  'centros-de-custo': {
    titulo: 'Centros de Custo',
    tabela: 'centro_de_custo',
    tela: 'CentroDeCusto',
    campos: [
      { key: 'codigo', label: 'Código', obrigatorio: true },
      { key: 'nome', label: 'Nome', obrigatorio: true },
      // Área do mapa de centros de custo do Template Budget (FLGS, CRO, People...).
      { key: 'area', label: 'Área' },
    ],
  },
  diretorias: {
    titulo: 'Diretorias',
    tabela: 'diretoria',
    tela: 'Diretoria',
    campos: [
      { key: 'nome', label: 'Nome', obrigatorio: true },
      { key: 'responsavel', label: 'Responsável' },
    ],
  },
  operacoes: {
    titulo: 'Operações',
    tabela: 'operacao',
    tela: 'Operacao',
    campos: [
      { key: 'nome', label: 'Nome', obrigatorio: true },
      { key: 'descricao', label: 'Descrição' },
    ],
  },
  produtos: {
    titulo: 'Produtos',
    tabela: 'produto',
    tela: 'Produto',
    campos: [
      { key: 'codigo', label: 'Código', obrigatorio: true },
      { key: 'nome', label: 'Nome', obrigatorio: true },
      { key: 'categoria', label: 'Categoria' },
    ],
  },
  clientes: {
    titulo: 'Clientes',
    tabela: 'cliente',
    tela: 'Cliente',
    campos: [
      { key: 'nome', label: 'Nome', obrigatorio: true },
      { key: 'documento', label: 'CNPJ/CPF' },
      { key: 'contato', label: 'Contato' },
    ],
  },
  fornecedores: {
    titulo: 'Fornecedores',
    tabela: 'fornecedor',
    tela: 'Fornecedor',
    campos: [
      { key: 'nome', label: 'Nome', obrigatorio: true },
      { key: 'documento', label: 'CNPJ/CPF' },
      { key: 'contato', label: 'Contato' },
    ],
  },
  layouts: {
    titulo: 'Layouts',
    tabela: 'layout',
    tela: 'Layout',
    campos: [
      { key: 'nome', label: 'Nome', obrigatorio: true },
      { key: 'tipo', label: 'Tipo' },
      { key: 'descricao', label: 'Descrição' },
    ],
  },
}
