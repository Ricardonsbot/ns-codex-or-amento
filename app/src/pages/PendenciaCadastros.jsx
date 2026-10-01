import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import FiltroBotoes from '../components/FiltroBotoes'
import { useToast } from '../components/ToastProvider'
import { useAuth } from '../components/AuthProvider'
import {
  fetchPendentes,
  aprovar,
  reprovar,
  tabelaDisponivel,
  fetchPendentesCentroCusto,
  aprovarCentroCusto,
  reprovarCentroCusto,
  centroCustoPendenteDisponivel,
} from '../lib/contasPendentesData'
import { PREFIXO_PL } from '../lib/linhasPl'
import BotaoRecolher from '../components/BotaoRecolher'

const DIMENSOES = [
  { valor: 'conta', rotulo: 'Conta' },
  { valor: 'centro_custo', rotulo: 'Centro de custo' },
]

const brl = (v) =>
  `R$ ${Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const quando = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—')

const SITUACOES = [
  { valor: 'pendente', rotulo: 'Pendentes' },
  { valor: 'aprovada', rotulo: 'Aprovadas' },
  { valor: 'reprovada', rotulo: 'Reprovadas' },
]

/**
 * Pendência de Cadastros: o que a importação encontrou na planilha (conta ou
 * centro de custo) e que ainda não existe no cadastro, esperando aprovação.
 *
 * Aprovar CRIA o cadastro (conta no plano, ou centro de custo), com a data e
 * o motivo registrados. A partir daí a próxima importação daquele rótulo
 * resolve sozinha.
 */
export default function PendenciaCadastros() {
  const showToast = useToast()
  const { user } = useAuth()
  const [listaConta, setListaConta] = useState([])
  const [listaCC, setListaCC] = useState([])
  const [situacao, setSituacao] = useState('pendente')
  const [dimensao, setDimensao] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [semTabelaConta, setSemTabelaConta] = useState(false)
  const [semTabelaCC, setSemTabelaCC] = useState(false)
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
      const [temConta, temCC] = await Promise.all([tabelaDisponivel(), centroCustoPendenteDisponivel()])
      setSemTabelaConta(!temConta)
      setSemTabelaCC(!temCC)
      const [conta, cc] = await Promise.all([
        temConta ? fetchPendentes() : Promise.resolve([]),
        temCC ? fetchPendentesCentroCusto() : Promise.resolve([]),
      ])
      setListaConta(conta.map((p) => ({ ...p, _dimensao: 'conta' })))
      setListaCC(cc.map((p) => ({ ...p, _dimensao: 'centro_custo' })))
    } catch (err) {
      showToast(`Erro ao carregar: ${err.message}`, 'error')
    } finally {
      setCarregando(false)
    }
  }

  function abrir(p) {
    setEmAnalise(p)
    if (p._dimensao === 'conta') {
      setForm({
        codigo: '',
        nome: p.rotulo,
        linhaPl: `${PREFIXO_PL[p.tipo]} > Gross Revenue`,
        categoria: p.tipo === 'receita' ? 'Gross Revenue' : '',
        observacao: '',
      })
    } else {
      setForm({ codigo: '', nome: p.rotulo, observacao: '' })
    }
  }

  async function handleAprovar() {
    if (!form.codigo.trim()) {
      showToast(
        emAnalise._dimensao === 'conta' ? 'Informe o código da conta no plano.' : 'Informe o código do centro de custo.',
        'warning'
      )
      return
    }
    setSalvando(true)
    try {
      if (emAnalise._dimensao === 'conta') {
        const conta = await aprovar(emAnalise, { ...form, quem: user?.email })
        showToast(`Conta ${conta.codigo} — ${conta.nome} criada no plano.`, 'success')
      } else {
        const cc = await aprovarCentroCusto(emAnalise, { ...form, quem: user?.email })
        showToast(`Centro de custo ${cc.codigo} — ${cc.nome} criado no cadastro.`, 'success')
      }
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
      if (p._dimensao === 'conta') await reprovar(p, { observacao: motivo, quem: user?.email })
      else await reprovarCentroCusto(p, { observacao: motivo, quem: user?.email })
      showToast(`"${p.rotulo}" reprovada.`, 'success')
      if (emAnalise?.id === p.id) setEmAnalise(null)
      await carregar()
    } catch (err) {
      showToast(`Não consegui reprovar: ${err.message}`, 'error')
    }
  }

  const lista = [...listaConta, ...listaCC]
  const visiveis = lista.filter((p) => p.status === situacao).filter((p) => !dimensao || p._dimensao === dimensao)
  const abertas = lista.filter((p) => p.status === 'pendente').length
  const totalmenteIndisponivel = semTabelaConta && semTabelaCC

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Pendência de Cadastros</h1>
          <p>Contas e centros de custo que a importação encontrou na planilha e que ainda não existem no cadastro</p>
        </div>
      </header>

      <div className="content">
        {totalmenteIndisponivel ? (
          <div className="panel">
            <div className="panel-body">
              <div className="proto-banner">
                ⓘ A fila de aprovação ainda não existe no banco. Rode
                <code> supabase/migrations/2026-09-09-pendencia-de-cadastros.sql </code>
                e
                <code> supabase/migrations/2026-10-01-pendencia-de-centro-de-custo.sql </code>
                no SQL Editor do Supabase. Até lá, a importação continua funcionando e as linhas entram apenas
                marcadas nas observações.
              </div>
            </div>
          </div>
        ) : (
          <>
            {semTabelaConta && (
              <div className="proto-banner" style={{ marginBottom: 12 }}>
                ⓘ A fila de conta ainda não existe no banco — falta rodar
                supabase/migrations/2026-09-09-pendencia-de-cadastros.sql.
              </div>
            )}
            {semTabelaCC && (
              <div className="proto-banner" style={{ marginBottom: 12 }}>
                ⓘ A fila de centro de custo ainda não existe no banco — falta rodar
                supabase/migrations/2026-10-01-pendencia-de-centro-de-custo.sql.
              </div>
            )}

            <div className="filter-bar">
              <FiltroBotoes
                label="Situação"
                valor={situacao}
                opcoes={SITUACOES}
                onChange={setSituacao}
                semTodas
              />
              <FiltroBotoes label="Tipo de cadastro" valor={dimensao} opcoes={DIMENSOES} onChange={setDimensao} />
              <span className="text-muted" style={{ marginLeft: 'auto' }}>
                {abertas} pendente(s) · {visiveis.length} nesta lista
              </span>
            </div>

            {emAnalise && (
              <div className="panel" style={{ marginBottom: 18 }}>
                <div className="panel-header">
                  <BotaoRecolher chave="pendencia-cadastros-1" />
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
                      <label>{emAnalise._dimensao === 'conta' ? 'Código no plano *' : 'Código *'}</label>
                      <input
                        type="text"
                        value={form.codigo}
                        placeholder={emAnalise._dimensao === 'conta' ? '3.1.01.006.008' : 'FLGS'}
                        onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                      />
                    </div>
                    <div className="filter-field" style={{ minWidth: 220 }}>
                      <label>{emAnalise._dimensao === 'conta' ? 'Nome da conta' : 'Nome do centro de custo'}</label>
                      <input
                        type="text"
                        value={form.nome}
                        onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      />
                    </div>
                    {emAnalise._dimensao === 'conta' && (
                      <>
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
                      </>
                    )}
                  </div>
                  <div className="filter-field" style={{ minWidth: 320, marginBottom: 12 }}>
                    <label>Motivo (fica registrado no cadastro)</label>
                    <input
                      type="text"
                      value={form.observacao}
                      placeholder={`Cadastrado a partir de "${emAnalise.rotulo}" do template ${emAnalise.origem ?? ''}`}
                      onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                    />
                  </div>
                  <div className="flex-row" style={{ gap: 8 }}>
                    <button className="btn btn-primary btn-sm" type="button" onClick={handleAprovar} disabled={salvando}>
                      {salvando ? 'Criando…' : '✓ Aprovar e cadastrar'}
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
                      ? 'Nada esperando aprovação. Quando uma importação encontrar conta ou centro de custo fora do cadastro, aparece aqui.'
                      : 'Nada nesta situação.'}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>ITEM</th>
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
                              <span className={`pill ${p._dimensao === 'conta' ? 'receita' : 'despesa'}`} style={{ marginRight: 6 }}>
                                {p._dimensao === 'conta' ? 'Conta' : 'Centro de custo'}
                              </span>
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
                                {(p.conta || p.centro_custo) && (
                                  <div style={{ color: 'var(--color-success, #1a7f47)' }}>
                                    → {(p.conta ?? p.centro_custo).codigo} {(p.conta ?? p.centro_custo).nome}
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
