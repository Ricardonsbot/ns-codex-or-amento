import { useEffect, useState } from 'react'
import { avaliar, exemploDeHistorico, historicoDisponivel, listarImportacoes } from '../lib/importacoesData'
import ChecklistImportacao from './ChecklistImportacao'
import BotaoUnidade from './BotaoUnidade'
import { useUnidade } from './UnidadeProvider'

const TIPOS = [
  { valor: 'receita', rotulo: 'Revenue' },
  { valor: 'despesa', rotulo: 'Expenses' },
  { valor: 'capex', rotulo: 'Capex' },
]
const ORIGEM = { gestao: 'Gestão de Importação', receita: 'tela (+) Revenue', despesa: 'tela (−) Expenses', capex: 'tela (−) Capex' }

const quando = (iso) => new Date(iso).toLocaleDateString('pt-BR')
const tamanhoArquivo = (b) => (b ? `${(b / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : '')

/** Uma linha "Rótulo: valor" do bloco de detalhes do arquivo. */
function Detalhe({ rotulo, children }) {
  return (
    <div className="detalhe-linha">
      <span>{rotulo}:</span>
      <div>{children}</div>
    </div>
  )
}

/**
 * Templates importados: um por linha, com os detalhes do arquivo, as duas
 * bolinhas de status (essencial e ideal), o motivo e se está apto a
 * consolidar — mais os números que o arquivo trouxe.
 *
 * Clicar em qualquer ponto da linha abre a janela de status. `versao` muda a
 * cada importação da tela, para a lista recarregar.
 */
export default function HistoricoImportacoes({ versao }) {
  const { numero, u } = useUnidade()
  const mi = (v) => (v ? numero(v) : '—')
  const [registros, setRegistros] = useState(null)
  const [semTabela, setSemTabela] = useState(false)
  const [erro, setErro] = useState(null)
  // Registro cuja janela de status está aberta.
  const [statusDe, setStatusDe] = useState(null)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        if (!(await historicoDisponivel())) {
          // Sem a tabela não há o que listar: mostra o exemplo, marcado como
          // tal, para a tela poder ser vista antes da migração.
          if (!cancelado) {
            setSemTabela(true)
            setRegistros(exemploDeHistorico())
          }
          return
        }
        const r = await listarImportacoes()
        if (!cancelado) {
          setRegistros(r)
          setErro(null)
        }
      } catch (err) {
        if (!cancelado) setErro(err.message)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [versao])

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-header">
        <div>
          <h2>Templates importados</h2>
          <p>Clique num template para ver o status · valores {u.faixa}, ano inteiro</p>
        </div>
        <BotaoUnidade />
      </div>
      <div className="panel-body">
        {semTabela && (
          <div className="proto-banner">
            ⓘ <strong>Exemplo.</strong> O histórico ainda não está disponível — falta rodar
            supabase/migrations/2026-09-22-historico-de-importacao.sql no Supabase. As duas linhas abaixo são
            fictícias, só para mostrar o formato; nada do que for importado fica registrado enquanto o SQL não rodar.
          </div>
        )}
        {erro && <div className="proto-banner">✕ Não consegui carregar o histórico: {erro}</div>}
        {!semTabela && !erro && !registros && <div className="empty-hint">Carregando…</div>}
        {registros && !registros.length && (
          <div className="empty-hint">Nenhum template importado ainda. Cada importação confirmada aparece aqui.</div>
        )}

        {registros?.length > 0 && (
          <div className="rolagem-x">
            <table className="data-table tabela-templates">
              <thead>
                <tr>
                  <th>DETALHES</th>
                  <th className="text-center">STATUS</th>
                  <th>MOTIVO</th>
                  <th>CONSOLIDAÇÃO</th>
                  <th>TIPOS</th>
                  <th className="text-right">EMPRESAS</th>
                  <th className="text-right">GROSS REVENUE</th>
                  <th className="text-right">NET REVENUE</th>
                  <th className="text-right">EXPENSES</th>
                  <th className="text-right">CAPEX</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => {
                  const t = r.totais ?? {}
                  const a = avaliar(r)
                  return (
                    <tr
                      key={r.id}
                      className="linha-template"
                      onClick={() => setStatusDe(r)}
                      title="Ver o status deste template"
                    >
                      <td>
                        <div className="detalhe-bloco">
                          <span className="detalhe-icone" aria-hidden="true">🗒</span>
                          <div>
                            <Detalhe rotulo="Nome">
                              <strong>{r.arquivo}</strong>
                              {r.exemplo && <span className="pill" style={{ marginLeft: 6 }}>exemplo</span>}
                            </Detalhe>
                            <Detalhe rotulo="Data Import">{quando(r.criado_em)}</Detalhe>
                            <Detalhe rotulo="User">
                              <span className="detalhe-email">{r.usuario_email ?? r.usuario_nome ?? '—'}</span>
                            </Detalhe>
                            <Detalhe rotulo="Ciclo">
                              {[r.ano, r.versao_nome].filter(Boolean).join(' - ') || '—'}
                            </Detalhe>
                            <div className="detalhe-origem">
                              {[tamanhoArquivo(r.tamanho_bytes), ORIGEM[r.origem]].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                        <span className={`bolinha ${a.corEssencial}`} title="Essencial" aria-hidden="true" />
                        <span className={`bolinha ${a.corIdeal}`} title="Ideal" aria-hidden="true" />
                      </td>
                      <td className="motivo-template">{a.motivo}</td>
                      <td className="motivo-template">{a.apto ? 'Apto para consolidar' : 'Não apto'}</td>
                      <td>
                        <div className="flex-row" style={{ gap: 4, flexWrap: 'wrap' }}>
                          {TIPOS.filter((x) => r.tipos?.[x.valor]).map((x) => {
                            const info = r.tipos[x.valor]
                            return (
                              <span
                                key={x.valor}
                                className={`pill ${x.valor}`}
                                title={
                                  `${info.linhas} linha(s)` +
                                  (info.apagados ? ` · substituiu ${info.apagados}` : '') +
                                  (info.desfeito ? ' · desfeito depois' : '')
                                }
                                style={info.desfeito ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}
                              >
                                {x.rotulo} · {info.linhas}
                              </span>
                            )
                          })}
                        </div>
                      </td>
                      <td className="text-right">{(r.empresas ?? []).length}</td>
                      <td className="text-right">{mi(t.gr)}</td>
                      <td className="text-right"><strong>{mi(t.nr)}</strong></td>
                      <td className="text-right">{mi(t.despesa)}</td>
                      <td className="text-right">{mi(t.capex)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {statusDe && <ChecklistImportacao registro={statusDe} onFechar={() => setStatusDe(null)} />}
    </div>
  )
}
