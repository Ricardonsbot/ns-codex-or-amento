import { Fragment, useEffect, useState } from 'react'
import { historicoDisponivel, listarImportacoes } from '../lib/importacoesData'

const TIPOS = [
  { valor: 'receita', rotulo: 'Revenue' },
  { valor: 'despesa', rotulo: 'Expenses' },
  { valor: 'capex', rotulo: 'Capex' },
]
const ORIGEM = { gestao: 'Gestão de Importação', receita: 'tela (+) Revenue', despesa: 'tela (−) Expenses', capex: 'tela (−) Capex' }

const umaCasa = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const mi = (v) => (v ? `${umaCasa(v / 1e6)}` : '—')
const quando = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const tamanhoArquivo = (b) => (b ? `${(b / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : '')

/**
 * Templates importados: um registro por arquivo, com quem subiu, para onde
 * foi e os números que ele trazia — no total e, abrindo a linha, por
 * empresa. `versao` muda a cada importação da tela, para a lista recarregar.
 */
export default function HistoricoImportacoes({ versao }) {
  const [registros, setRegistros] = useState(null)
  const [semTabela, setSemTabela] = useState(false)
  const [erro, setErro] = useState(null)
  const [aberto, setAberto] = useState(null)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        if (!(await historicoDisponivel())) {
          if (!cancelado) setSemTabela(true)
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
          <p>Quem subiu cada arquivo e o que ele trazia, no momento da importação · valores em R$ M, ano inteiro</p>
        </div>
      </div>
      <div className="panel-body">
        {semTabela && (
          <div className="proto-banner">
            ⓘ O histórico ainda não está disponível — falta rodar
            supabase/migrations/2026-09-22-historico-de-importacao.sql no Supabase. A importação funciona normalmente
            enquanto isso, só não fica registrada.
          </div>
        )}
        {erro && <div className="proto-banner">✕ Não consegui carregar o histórico: {erro}</div>}
        {!semTabela && !erro && !registros && <div className="empty-hint">Carregando…</div>}
        {registros && !registros.length && (
          <div className="empty-hint">Nenhum template importado ainda. Cada importação confirmada aparece aqui.</div>
        )}

        {registros?.length > 0 && (
          <div className="rolagem-x">
            <table className="data-table">
              <thead>
                <tr>
                  <th aria-label="Abrir" />
                  <th>DATA</th>
                  <th>ARQUIVO</th>
                  <th>USUÁRIO</th>
                  <th>DESTINO</th>
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
                  const empresas = r.empresas ?? []
                  const estaAberto = aberto === r.id
                  return (
                    <Fragment key={r.id}>
                      <tr style={{ cursor: 'pointer' }} onClick={() => setAberto(estaAberto ? null : r.id)}>
                        <td style={{ width: 24, color: 'var(--color-text-muted)' }}>{estaAberto ? '▾' : '▸'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{quando(r.criado_em)}</td>
                        <td>
                          <strong>{r.arquivo}</strong>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                            {[tamanhoArquivo(r.tamanho_bytes), ORIGEM[r.origem]].filter(Boolean).join(' · ')}
                          </div>
                        </td>
                        <td>
                          {r.usuario_nome ?? r.usuario_email ?? '—'}
                          {r.usuario_nome && (
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{r.usuario_email}</div>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {r.ano ?? '—'}
                          {r.versao_nome ? ` · ${r.versao_nome}` : ''}
                        </td>
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
                        <td className="text-right">{empresas.length}</td>
                        <td className="text-right">{mi(t.gr)}</td>
                        <td className="text-right"><strong>{mi(t.nr)}</strong></td>
                        <td className="text-right">{mi(t.despesa)}</td>
                        <td className="text-right">{mi(t.capex)}</td>
                      </tr>
                      {estaAberto && (
                        <tr>
                          <td />
                          <td colSpan={10} style={{ background: 'var(--color-bg)' }}>
                            <table className="data-table" style={{ margin: '4px 0' }}>
                              <thead>
                                <tr>
                                  <th>EMPRESA</th>
                                  <th className="text-right">LINHAS</th>
                                  <th className="text-right">GROSS REVENUE</th>
                                  <th className="text-right">NET REVENUE</th>
                                  <th className="text-right">EXPENSES</th>
                                  <th className="text-right">CAPEX</th>
                                </tr>
                              </thead>
                              <tbody>
                                {empresas.map((e) => (
                                  <tr key={e.id ?? e.nome}>
                                    <td>{e.nome}</td>
                                    <td className="text-right">{e.linhas}</td>
                                    <td className="text-right">{mi(e.gr)}</td>
                                    <td className="text-right"><strong>{mi(e.nr)}</strong></td>
                                    <td className="text-right">{mi(e.despesa)}</td>
                                    <td className="text-right">{mi(e.capex)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
