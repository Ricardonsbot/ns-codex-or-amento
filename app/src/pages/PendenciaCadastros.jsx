import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import FiltroBotoes from '../components/FiltroBotoes'
import { useToast } from '../components/ToastProvider'
import { useAuth } from '../components/AuthProvider'
import { fetchPendentes, aprovar, reprovar, tabelaDisponivel } from '../lib/contasPendentesData'
import { PREFIXO_PL } from '../lib/linhasPl'

const brl = (v) =>
  `R$ ${Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const quando = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—')

const SITUACOES = [
  { valor: 'pendente', rotulo: 'Pendentes' },
  { valor: 'aprovada', rotulo: 'Aprovadas' },
  { valor: 'reprovada', rotulo: 'Reprovadas' },
]

/**
 * Pendência de Cadastros: as contas que a importação encontrou na planilha e
 * que não existem no plano, esperando aprovação.
 *
 * Aprovar CRIA a conta no plano, com a data e o motivo registrados nela. A
 * partir daí a próxima importação daquele rótulo resolve sozinha.
 */
export default function PendenciaCadastros() {
  const showToast = useToast()
  const { user } = useAuth()
  const [lista, setLista] = useState([])
  const [situacao, setSituacao] = useState('pendente')
  const [carregando, setCarregando] = useState(true)
  const [semTabela, setSemTabela] = useState(false)
  const [emAnalise, setEmAnalise] = useState(null) // a pendência aberta no formulário
  const [form, setForm] = useState({ codigo: '', nome: '', linhaPl: '', categoria: '', observacao: '' })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function carregar() {
    setCarregando(true)
    try {
      if (!(await tabelaDisponivel())) {
        setSemTabela(true)
        return
      }
      setLista(await fetchPendentes())
    } catch (err) {
      showToast(`Erro ao carregar: ${err.message}`, 'error')
    } finally {
      setCarregando(false)
    }
  }

  function abrir(p) {
    setEmAnalise(p)
    setForm({
      codigo: '',
      nome: p.rotulo,
      linhaPl: `${PREFIXO_PL[p.tipo]} > Gross Revenue`,
      categoria: p.tipo === 'receita' ? 'Gross Revenue' : '',
      observacao: '',
    })
  }

  async function handleAprovar() {
    if (!form.codigo.trim()) {
      showToast('Informe o código da conta no plano.', 'warning')
      return
    }
    setSalvando(true)
    try {
      const conta = await aprovar(emAnalise, { ...form, quem: user?.email })
      showToast(`Conta ${conta.codigo} — ${conta.nome} criada no plano.`, 'success')
      setEmAnalise(null)
      await carregar()
    } catch (err) {
      showToast(`Não consegui aprovar: ${err.message}`, 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function handleReprovar(p) {
    const motivo = window.prompt(`Reprovar "${p.rotulo}"? Diga o motivo (aparece para quem pediu):`)
    if (motivo === null) return
    try {
      await reprovar(p, { observacao: motivo, quem: user?.email })
      showToast(`"${p.rotulo}" reprovada.`, 'success')
      if (emAnalise?.id === p.id) setEmAnalise(null)
      await carregar()
    } catch (err) {
      showToast(`Não consegui reprovar: ${err.message}`, 'error')
    }
  }

  const visiveis = lista.filter((p) => p.status === situacao)
  const abertas = lista.filter((p) => p.status === 'pendente').length

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Pendência de Cadastros</h1>
          <p>Contas que a importação encontrou na planilha e que ainda não existem no plano</p>
        </div>
      </header>

      <div className="content">
        {semTabela ? (
          <div className="panel">
            <div className="panel-body">
              <div className="proto-banner">
                ⓘ A fila de aprovação ainda não existe no banco. Rode
                <code> supabase/migrations/2026-09-09-pendencia-de-cadastros.sql </code>
                no SQL Editor do Supabase. Até lá, a importação continua funcionando e as linhas sem conta
                entram apenas marcadas nas observações.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="filter-bar">
              <FiltroBotoes
                label="Situação"
                valor={situacao}
                opcoes={SITUACOES}
                onChange={setSituacao}
                semTodas
              />
              <span className="text-muted" style={{ marginLeft: 'auto' }}>
                {abertas} pendente(s) · {visiveis.length} nesta lista
              </span>
            </div>

            {emAnalise && (
              <div className="panel" style={{ marginBottom: 18 }}>
                <div className="panel-header">
                  <div>
                    <h2>Cadastrar “{emAnalise.rotulo}”</h2>
                    <p>
                      {emAnalise.descricao} · {brl(emAnalise.valor)} de orçamento depende dela
                    </p>
                  </div>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEmAnalise(null)}>
                    Cancelar
                  </button>
                </div>
                <div className="panel-body">
                  <div className="filter-bar" style={{ marginBottom: 12 }}>
                    <div className="filter-field">
                      <label>Código no plano *</label>
                      <input
                        type="text"
                        value={form.codigo}
                        placeholder="3.1.01.006.008"
                        onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                      />
                    </div>
                    <div className="filter-field" style={{ minWidth: 220 }}>
                      <label>Nome da conta</label>
                      <input
                        type="text"
                        value={form.nome}
                        onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      />
                    </div>
                    <div className="filter-field" style={{ minWidth: 220 }}>
                      <label>Linha do P&amp;L</label>
                      <input
                        type="text"
                        value={form.linhaPl}
                        onChange={(e) => setForm({ ...form, linhaPl: e.target.value })}
                      />
                    </div>
                    <div className="filter-field">
                      <label>Categoria</label>
                      <input
                        type="text"
                        value={form.categoria}
                        onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="filter-field" style={{ minWidth: 320, marginBottom: 12 }}>
                    <label>Motivo (fica registrado no plano de contas)</label>
                    <input
                      type="text"
                      value={form.observacao}
                      placeholder={`Cadastrada a partir de "${emAnalise.rotulo}" do template ${emAnalise.origem ?? ''}`}
                      onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                    />
                  </div>
                  <div className="flex-row" style={{ gap: 8 }}>
                    <button className="btn btn-primary btn-sm" type="button" onClick={handleAprovar} disabled={salvando}>
                      {salvando ? 'Criando…' : '✓ Aprovar e cadastrar no plano'}
                    </button>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => handleReprovar(emAnalise)}>
                      ✕ Reprovar
                    </button>
                  </div>
                  <p style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                    O código não é sugerido de propósito: onde a conta entra na hierarquia do plano é decisão de
                    contabilidade. Aprovar cria a conta e guarda nela a data e o motivo.
                  </p>
                </div>
              </div>
            )}

            <div className="panel">
              <div className="panel-body">
                {carregando ? (
                  <p>Carregando…</p>
                ) : !visiveis.length ? (
                  <div className="empty-hint">
                    {situacao === 'pendente'
                      ? 'Nenhuma conta esperando aprovação. Quando uma importação encontrar conta fora do plano, ela aparece aqui.'
                      : 'Nada nesta situação.'}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>CONTA</th>
                          <th>DESCRIÇÃO</th>
                          <th>MOTIVO</th>
                          <th className="text-right">VALOR</th>
                          <th>PEDIDO</th>
                          {situacao === 'pendente' ? <th /> : <th>DECISÃO</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {visiveis.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <strong>{p.rotulo}</strong>
                              <div style={{ fontSize: 11, opacity: 0.6 }}>
                                {p.tipo} · {p.linhas} linha(s) · {p.origem ?? '—'}
                              </div>
                            </td>
                            <td style={{ fontSize: 12 }}>{p.descricao ?? '—'}</td>
                            <td style={{ fontSize: 12 }}>{p.motivo ?? '—'}</td>
                            <td className="text-right">{brl(p.valor)}</td>
                            <td style={{ fontSize: 12 }}>
                              {quando(p.solicitado_em)}
                              <div style={{ opacity: 0.6 }}>{p.solicitado_por ?? '—'}</div>
                            </td>
                            {situacao === 'pendente' ? (
                              <td>
                                <div className="flex-row" style={{ gap: 6 }}>
                                  <button className="btn btn-primary btn-sm" type="button" onClick={() => abrir(p)}>
                                    Analisar
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    type="button"
                                    onClick={() => handleReprovar(p)}
                                  >
                                    Reprovar
                                  </button>
                                </div>
                              </td>
                            ) : (
                              <td style={{ fontSize: 12 }}>
                                {quando(p.decidido_em)}
                                <div style={{ opacity: 0.6 }}>{p.decidido_por ?? '—'}</div>
                                {p.conta && (
                                  <div style={{ color: 'var(--color-success, #1a7f47)' }}>
                                    → {p.conta.codigo} {p.conta.nome}
                                  </div>
                                )}
                                {p.observacao_decisao && (
                                  <div style={{ opacity: 0.7 }}>{p.observacao_decisao}</div>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
