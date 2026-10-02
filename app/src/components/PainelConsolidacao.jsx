import { Link } from 'react-router-dom'

/**
 * Os dois quadros do lado direito do Dashboard: quem já subiu e quem falta.
 *
 * Juntos respondem a pergunta que se faz todo dia no fechamento do budget —
 * "estamos esperando quem?". Separados, o Dashboard respondia só a metade
 * fácil: mostrava o número que existe, nunca o que está faltando para ele
 * ficar completo.
 *
 * Os dois levam para a Gestão de Importação, que é onde se age: num caso
 * para conferir o que entrou, no outro para cobrar o que não entrou.
 */

const quando = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** O e-mail inteiro não cabe na coluna; o que vem antes do @ basta. */
const quem = (r) => r.usuario_nome || (r.usuario_email ? r.usuario_email.split('@')[0] : '—')

function Recentes({ lista, indisponivel }) {
  return (
    <div className="panel painel-consolidacao">
      <div className="panel-header">
        <div>
          <h2>Recentes</h2>
          <p>Últimos templates que subiram para a consolidação</p>
        </div>
        <Link className="btn btn-secondary btn-sm" to="/gestao-importacao">
          Ver todos
        </Link>
      </div>
      <div className="panel-body">
        {indisponivel ? (
          <div className="empty-hint">
            O histórico de importações ainda não está no banco — falta rodar a migração
            2026-09-22-historico-de-importacao.sql.
          </div>
        ) : !lista.length ? (
          <div className="empty-hint">Nenhum template importado ainda neste ciclo.</div>
        ) : (
          <table className="data-table tabela-consolidacao">
            <tbody>
              {lista.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to="/gestao-importacao" className="link-linha">
                      {r.arquivo}
                    </Link>
                    <div className="consolidacao-sub">
                      {quem(r)}
                      {r.ano ? ` · ${r.ano}` : ''}
                      {r.versao_nome ? ` / ${r.versao_nome}` : ''}
                    </div>
                  </td>
                  <td className="text-right consolidacao-quando">{quando(r.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Falta({ lista, carregando }) {
  return (
    <div className="panel painel-consolidacao">
      <div className="panel-header">
        <div>
          <h2>Falta</h2>
          <p>
            {carregando
              ? 'Conferindo quem já lançou…'
              : lista.length
              ? `${lista.length} empresa(s) sem nenhum lançamento nesta versão`
              : 'Todas as empresas do recorte já lançaram'}
          </p>
        </div>
      </div>
      <div className="panel-body">
        {!carregando && !lista.length ? (
          <div className="empty-hint">Nada pendente.</div>
        ) : (
          /* Em ordem alfabética, não por tamanho: aqui ninguém procura a
             maior, procura a sua. */
          <ul className="lista-falta">
            {lista.map((e) => (
              <li key={e.id ?? e.nome} title={e.nome}>
                {e.nome}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function PainelConsolidacao({ recentes, historicoIndisponivel, faltam, carregando }) {
  return (
    <div className="coluna-consolidacao">
      <Recentes lista={recentes ?? []} indisponivel={historicoIndisponivel} />
      <Falta lista={faltam ?? []} carregando={carregando} />
    </div>
  )
}
