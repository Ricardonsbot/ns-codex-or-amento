import { useEffect, useRef } from 'react'
import BotaoRecolher from './BotaoRecolher'

/**
 * Passo a passo de como submeter um Template Budget.
 *
 * Aparece de dois jeitos: como quadro na tela de importação, marcando em que
 * etapa a pessoa está, e como janela pelo botão "Como importar" — quem já
 * sabe o caminho não precisa do quadro ocupando a tela.
 *
 * `etapa` é a etapa corrente; os passos anteriores ficam marcados como
 * vencidos. `modo` escolhe de quem é o caminho: o do FP&A, que grava
 * lançamento conferindo card por card, ou o do pacoteiro, que grava um
 * teto por pacote e não tem card nenhum para conferir.
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
      'Clique em "Selecionar Template" e depois em "Escolher arquivo". Um upload só serve para Receita, Despesa e Capex. Se quem preencheu foi o pacoteiro, entre por "Pacote → Importar target" no menu, não por aqui: lá o total por pacote entra como teto do ano, e não como lançamento.',
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
    dica: 'Se a versão já tem lançamentos daquele tipo, marque "Apagar os que já existem antes de importar" — senão o orçamento soma em cima e dobra.',
  },
  {
    n: 5,
    titulo: 'Importe e confirme',
    texto:
      'Clique em "Importar" no card de cada tipo e acompanhe a barra de gravação. No fim, a faixa mostra o resultado e o template entra na lista abaixo. Deu errado? "Desfazer" apaga exatamente o que aquela importação criou.',
    dica: 'Conta que não existia no plano vai sozinha para Fluxo → Pendência de Cadastros, para alguém aprovar.',
  },
]

/**
 * O caminho do pacoteiro. Não é o do FP&A com as palavras trocadas: ele
 * sobe o mesmo arquivo para gravar outra coisa — um teto por pacote — e o
 * que precisa conferir antes de gravar também é outro.
 */
const PASSOS_PACOTE = [
  {
    n: 1,
    titulo: 'Prepare o arquivo',
    texto:
      'É o mesmo Template Budget do ano que as empresas preenchem (.xlsb, .xlsx ou .xlsm), com as abas Receita e Base Gastos. Não renomeie as abas nem as colunas. Para o target o que manda é a coluna Pacote: linha sem pacote preenchido não tem onde entrar e fica de fora.',
    dica: 'O ano do cabeçalho do template decide o ano do target.',
  },
  {
    n: 2,
    titulo: 'Selecione o template',
    texto:
      'Clique em "Selecionar Template" e escolha o arquivo. A leitura é a mesma de sempre e leva de 20 a 45 segundos num arquivo de ~9 MB; dá para fechar a janela e continuar na tela.',
  },
  {
    n: 3,
    titulo: 'Confira o total por pacote',
    texto:
      'A ferramenta soma o arquivo inteiro e devolve uma linha por pacote — é isso que vira target. Conta, centro de custo e fornecedor não entram: target é do pacote, e o detalhe é das empresas.',
    dica: 'Pacote escrito diferente do cadastro não casa com o bottom up. Confira os nomes em Cadastros → Pacotes antes de gravar.',
  },
  {
    n: 4,
    titulo: 'Grave o target',
    texto:
      'Gravar põe o teto do ano de cada pacote. O seu arquivo não vira lançamento: quem lança são as empresas, por baixo — gravar os dois contaria o mesmo gasto duas vezes. A diferença entre os dois aparece em Resultado → Target × Bottom Up.',
    dica: 'Já existe target do ano? Marque substituir; senão o antigo continua lá e o novo não entra.',
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

function Lista({ etapa, passos }) {
  return (
    <ol className="lista-passos">
      {passos.map((p) => (
        <Passo key={p.n} passo={p} estado={etapa > p.n ? 'vencido' : etapa === p.n ? 'atual' : 'futuro'} />
      ))}
    </ol>
  )
}

export default function TutorialImportacao({ etapa = 1, modo = 'fpa', janela, onFechar }) {
  const pacote = modo === 'pacote'
  const passos = pacote ? PASSOS_PACOTE : PASSOS
  const titulo = pacote ? 'Como submeter o target do pacote' : 'Como submeter um template'
  const fechar = useRef(null)
  useEffect(() => {
    if (!janela) return undefined
    fechar.current?.focus()
    const esc = (e) => e.key === 'Escape' && onFechar?.()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [janela, onFechar])

  if (!janela) {
    return (
      <div className="panel">
        <div className="panel-header">
          <BotaoRecolher chave="tutorial-importacao-1" />
          <div>
            <h2>{titulo}</h2>
            <p>
              {pacote
                ? 'Quatro passos, do arquivo até o teto do ano gravado'
                : 'Cinco passos, do arquivo até o orçamento gravado'}
            </p>
          </div>
        </div>
        <div className="panel-body">
          <Lista etapa={etapa} passos={passos} />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h3>{titulo}</h3>
          <button ref={fechar} className="modal-close" type="button" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="modal-body">
          <Lista etapa={etapa} passos={passos} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
