import BotaoRecolher from './BotaoRecolher'

/**
 * Passo a passo de como submeter um Template Budget.
 *
 * Aparece como quadro na tela de importação, marcando em que etapa a pessoa
 * está. Era também uma janela, aberta pelo botão "Como importar" das telas
 * de Revenue e Expenses — o botão saiu, e a importação mora só na Gestão.
 *
 * `etapa` é a etapa corrente (1 a 5); os passos anteriores ficam marcados
 * como vencidos.
 */
const PASSOS = [
  {
    n: 1,
    titulo: 'Prepare o arquivo',
    texto:
      'O template é um só, o mesmo para empresas, corporate e pacoteiros: o Template Budget do ano (.xlsb, .xlsx ou .xlsm), com as abas Receita e Base Gastos. Não renomeie as abas nem as colunas: é por elas que a leitura se orienta.',
    dica: 'O ano do cabeçalho do template decide o ciclo de destino — 2027 entra no ciclo 2027, sempre na versão atual dele.',
  },
  {
    n: 2,
    titulo: 'Selecione o template',
    texto:
      'Clique em "Selecionar Template" e depois em "Escolher arquivo". Um upload só serve para Receita, Despesa e Capex. Se quem preencheu foi o pacoteiro, entre por "Importar - Pacote" no menu, não por "Template FP&A": aí o total por pacote entra como teto do ano, e não como lançamento.',
  },
  {
    n: 3,
    titulo: 'Acompanhe a leitura',
    texto:
      'O assistente confere as três abas — se existem e se têm as colunas exigidas — e depois lê linha a linha. Leva de 20 a 45 segundos num arquivo de ~9 MB; dá para fechar a janela e continuar na tela.',
  },
  {
    n: 4,
    titulo: 'Confira o status antes de gravar',
    texto:
      'Cada tipo vira um card com o total de linhas, o valor do ano e a faixa de status. Vermelho é impedimento: empresa ou conta fora do cadastro, centro de custo faltando, sinal trocado. Amarelo é pendência, e consolida assim mesmo.',
    dica: 'Se a versão já tem lançamentos daquele tipo, o aviso aparece ao lado do título — importar sempre soma em cima dos que já existem. Pra apagar os antigos, use "Substituir" depois, na janela de status do template já importado.',
  },
  {
    n: 5,
    titulo: 'Importe e confirme',
    texto:
      'Clique em "Importar" no card de cada tipo e acompanhe a barra de gravação. No fim, a faixa mostra o resultado e o template entra na lista abaixo. Deu errado? "Desfazer" apaga exatamente o que aquela importação criou.',
    dica: 'Conta que não existia no plano vai sozinha para Fluxo → Pendência de Cadastros, para alguém aprovar.',
  },
]

function Passo({ passo, estado }) {
  return (
    <li className={`passo-importacao ${estado}`}>
      <span className="passo-numero" aria-hidden="true">
        {estado === 'vencido' ? '✓' : passo.n}
      </span>
      <div>
        <strong>{passo.titulo}</strong>
        <p>{passo.texto}</p>
        {passo.dica && <p className="passo-dica">⚠ {passo.dica}</p>}
      </div>
    </li>
  )
}

function Lista({ etapa }) {
  return (
    <ol className="lista-passos">
      {PASSOS.map((p) => (
        <Passo key={p.n} passo={p} estado={etapa > p.n ? 'vencido' : etapa === p.n ? 'atual' : 'futuro'} />
      ))}
    </ol>
  )
}

export default function TutorialImportacao({ etapa = 1 }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <BotaoRecolher chave="tutorial-importacao-1" />
        <div>
          <h2>Como submeter um template</h2>
          <p>Cinco passos, do arquivo até o orçamento gravado</p>
        </div>
      </div>
      <div className="panel-body">
        <Lista etapa={etapa} />
      </div>
    </div>
  )
}
