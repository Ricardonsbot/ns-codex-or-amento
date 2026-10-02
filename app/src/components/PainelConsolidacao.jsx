import { useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * Os dois quadros do lado direito do Dashboard: quem já subiu e o andamento
 * de cada empresa.
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

/** As três cores do farol, na ordem em que a legenda as mostra. */
const FAROL = [
  { cor: 'vermelho', rotulo: 'sem template' },
  { cor: 'amarelo', rotulo: 'aguardando liberação' },
  { cor: 'verde', rotulo: 'liberado' },
]

/**
 * Toda empresa do recorte com o farol da liberação ao lado. Antes a lista era
 * só de quem faltava — dizia quem não mandou, mas não quem mandou e ainda
 * espera alguém aceitar, que é o que segura o consolidado no fechamento.
 *
 * A legenda conta cada cor e serve de filtro: clicar em "aguardando" deixa só
 * quem está esperando liberação.
 */
function Andamento({ lista, carregando, liberacaoIndisponivel }) {
  const [so, setSo] = useState(null)
  const conta = (cor) => lista.filter((e) => e.farol === cor).length
  const visiveis = so ? lista.filter((e) => e.farol === so) : lista
  const faltam = conta('vermelho')

  return (
    <div className="panel painel-consolidacao">
      <div className="panel-header">
        <div>
          <h2>Andamento</h2>
          <p>
            {carregando
              ? 'Conferindo quem já lançou…'
              : !lista.length
              ? 'Nenhuma empresa no recorte'
              : faltam
              ? `${faltam} de ${lista.length} empresa(s) sem template nesta versão`
              : 'Todas as empresas do recorte já mandaram template'}
          </p>
        </div>
      </div>
      <div className="panel-body">
        {!carregando && !lista.length ? (
          <div className="empty-hint">Nada para mostrar.</div>
        ) : (
          <>
            {liberacaoIndisponivel ? (
              <p className="farol-aviso">
                <span className="bolinha cinza" aria-hidden="true" />
                A liberação ainda não está no banco — falta rodar as migrações do histórico de importação. Por
                enquanto, só o vermelho (sem template) é certo.
              </p>
            ) : (
              <div className="farol-legenda" role="group" aria-label="Filtrar pelo farol">
                {FAROL.map((f) => (
                  <button
                    key={f.cor}
                    type="button"
                    className={`farol-filtro${so === f.cor ? ' ativo' : ''}`}
                    aria-pressed={so === f.cor}
                    onClick={() => setSo(so === f.cor ? null : f.cor)}
                  >
                    <span className={`bolinha ${f.cor}`} aria-hidden="true" />
                    {conta(f.cor)} {f.rotulo}
                  </button>
                ))}
              </div>
            )}
            {/* Em ordem alfabética, não por tamanho: aqui ninguém procura a
                maior, procura a sua. */}
            <ul className="lista-falta">
              {visiveis.map((e) => (
                <li key={e.id} title={`${e.nome} — ${FAROL.find((f) => f.cor === e.farol)?.rotulo ?? 'liberação desconhecida'}`}>
                  <span className={`bolinha ${e.farol}`} aria-hidden="true" />
                  {e.nome}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

export default function PainelConsolidacao({ recentes, historicoIndisponivel, andamento, liberacaoIndisponivel, carregando }) {
  return (
    <div className="coluna-consolidacao">
      <Recentes lista={recentes ?? []} indisponivel={historicoIndisponivel} />
      <Andamento lista={andamento ?? []} carregando={carregando} liberacaoIndisponivel={liberacaoIndisponivel} />
    </div>
  )
}
