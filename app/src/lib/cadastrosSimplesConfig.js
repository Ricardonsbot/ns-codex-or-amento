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
      // A área do mapa do Template Budget viria aqui como { key: 'area' }, mas a
      // coluna não existe na tabela: enquanto isso, o importador embute a área no
      // próprio nome ("FLGS · CSC - FP&A"). Declarar o campo sem a coluna faria o
      // formulário enviar `area` e o PostgREST rejeitar a gravação.
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
      // O grupo é texto: a lista oficial fica em "Grupos de Fornecedor", e
      // digitar aqui é o que amarra um ao outro enquanto não há seleção.
      { key: 'grupo', label: 'Grupo' },
    ],
  },
  'grupos-de-fornecedor': {
    titulo: 'Grupos de Fornecedor',
    tabela: 'fornecedor_grupo',
    tela: 'FornecedorGrupo',
    campos: [
      { key: 'nome', label: 'Nome', obrigatorio: true },
      { key: 'descricao', label: 'Descrição' },
    ],
  },
  pacotes: {
    titulo: 'Pacotes',
    tabela: 'pacote',
    tela: 'Pacote',
    campos: [
      { key: 'nome', label: 'Nome', obrigatorio: true },
      { key: 'descricao', label: 'Descrição' },
    ],
  },
  'targets-pacote': {
    titulo: 'Targets por Pacote',
    tabela: 'target_pacote',
    tela: 'TargetPacote',
    campos: [
      { key: 'ano', label: 'Ano', obrigatorio: true },
      { key: 'pacote', label: 'Pacote', obrigatorio: true },
      { key: 'valor', label: 'Target do ano (R$)', obrigatorio: true },
      { key: 'responsavel', label: 'Responsável' },
      { key: 'observacao', label: 'Observação' },
    ],
  },
  subpacotes: {
    titulo: 'Subpacotes',
    tabela: 'subpacote',
    tela: 'Subpacote',
    campos: [
      { key: 'pacote', label: 'Pacote', obrigatorio: true },
      { key: 'nome', label: 'Nome', obrigatorio: true },
      { key: 'descricao', label: 'Descrição' },
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
