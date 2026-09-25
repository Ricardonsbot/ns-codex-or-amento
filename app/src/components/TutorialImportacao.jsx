import { useEffect, useRef } from 'react'

/**
 * Passo a passo de como submeter um Template Budget.
 *
 * Aparece de dois jeitos: como quadro na tela de importação, marcando em que
 * etapa a pessoa está, e como janela pelo botão "Como importar" — quem já
 * sabe o caminho não precisa do quadro ocupando a tela.
 *
 * `etapa` é a etapa corrente (1 a 5); os passos anteriores ficam marcados
 * como vencidos.
 */
const PASSOS = [
  {
    n: 1,
    titulo: 'Prepare o arquivo',
    texto:
      'São quatro templates, e cada um cobra o que é dele: Empresas (Receita, Base Gastos e Capex), Corporate Non Labor, Corporate Labor e Pacoteiros. Use o do ano (.xlsb, .xlsx ou .xlsm) e não renomeie as abas nem as colunas: é por elas que a leitura se orienta.',
    dica: 'Deixe o formato no nome do arquivo — "Corporate Non Labor 2027" — e a ferramenta já abre no formato certo. Dá para trocar na mão depois.',
  },
  {
    n: 2,
    titulo: 'Selecione o template',
    texto:
      'Clique em "Selecionar Template" e escolha o arquivo. Um upload só serve para Receita, Despesa e Capex. Confira a faixa de formato no topo antes de seguir — o Pacoteiros não grava lançamento, grava o target do ano.',
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

export default function TutorialImportacao({ etapa = 1, janela, onFechar }) {
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

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" aria-label="Como submeter um template">
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h3>Como submeter um template</h3>
          <button ref={fechar} className="modal-close" type="button" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="modal-body">
          <Lista etapa={etapa} />
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
