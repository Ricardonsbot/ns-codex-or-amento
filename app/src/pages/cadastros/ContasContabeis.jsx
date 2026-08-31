import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useToast } from '../../components/ToastProvider'
import ImportExportBar from '../../components/ImportExportBar'
import { fetchContas, createConta, updateConta, deleteConta } from '../../lib/contasData'

const CAMPOS_VAZIOS = { codigo: '', nome: '', linha_pl: '', categoria: '' }
const COLUNAS = [
  { key: 'codigo', label: 'Código', obrigatorio: true },
  { key: 'nome', label: 'Nome', obrigatorio: true },
  { key: 'linha_pl', label: 'Linha do P&L' },
  { key: 'categoria', label: 'Categoria' },
]

export default function ContasContabeis() {
  const showToast = useToast()
  const [contas, setContas] = useState([])
  const [loading, setLoading] = useState(true)
  const [novaConta, setNovaConta] = useState(CAMPOS_VAZIOS)
  const [salvandoNova, setSalvandoNova] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [rascunhoEdicao, setRascunhoEdicao] = useState(CAMPOS_VAZIOS)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)
    try {
      setContas(await fetchContas())
    } catch (err) {
      showToast(`Erro ao carregar contas: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdicionar(e) {
    e.preventDefault()
    if (!novaConta.codigo.trim() || !novaConta.nome.trim()) {
      showToast('Preencha ao menos Código e Nome.', 'warning')
      return
    }
    setSalvandoNova(true)
    try {
      const criada = await createConta(novaConta)
      setContas((atual) => [...atual, criada].sort((a, b) => a.codigo.localeCompare(b.codigo)))
      setNovaConta(CAMPOS_VAZIOS)
      showToast('Conta cadastrada com sucesso.', 'success')
    } catch (err) {
      showToast(`Erro ao cadastrar conta: ${err.message}`, 'error')
    } finally {
      setSalvandoNova(false)
    }
  }

  function iniciarEdicao(conta) {
    setEditandoId(conta.id)
    setRascunhoEdicao({
      codigo: conta.codigo,
      nome: conta.nome,
      linha_pl: conta.linha_pl ?? '',
      categoria: conta.categoria ?? '',
    })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setRascunhoEdicao(CAMPOS_VAZIOS)
  }

  async function salvarEdicao(id) {
    try {
      const atualizada = await updateConta(id, rascunhoEdicao)
      setContas((atual) => atual.map((c) => (c.id === id ? atualizada : c)))
      cancelarEdicao()
      showToast('Conta atualizada.', 'success')
    } catch (err) {
      showToast(`Erro ao atualizar conta: ${err.message}`, 'error')
    }
  }

  async function handleExcluir(conta) {
    if (!window.confirm(`Excluir a conta "${conta.codigo} — ${conta.nome}"?`)) return
    try {
      await deleteConta(conta.id)
      setContas((atual) => atual.filter((c) => c.id !== conta.id))
      showToast('Conta excluída.', 'success')
    } catch (err) {
      showToast(`Erro ao excluir conta: ${err.message}`, 'error')
    }
  }

  async function handleImportarLinha(linhaCsv) {
    if (!linhaCsv.codigo?.trim() || !linhaCsv.nome?.trim()) throw new Error('faltando código ou nome')
    return createConta({
      codigo: linhaCsv.codigo,
      nome: linhaCsv.nome,
      linha_pl: linhaCsv.linha_pl ?? '',
      categoria: linhaCsv.categoria ?? '',
    })
  }

  function handleImportConcluido(novas) {
    setContas((atual) => [...atual, ...novas].sort((a, b) => a.codigo.localeCompare(b.codigo)))
  }

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Contas Contábeis</h1>
          <p>Plano de contas usado nos lançamentos de Receita, Despesa e Capex</p>
        </div>
        <div className="topbar-actions">
          <Link to="/cadastros" className="btn btn-secondary">← Voltar aos Cadastros</Link>
        </div>
      </header>

      <div className="content">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Nova Conta</h2>
              <p>Cadastre uma conta contábil para uso no plano de contas</p>
            </div>
          </div>
          <div className="panel-body">
            <form onSubmit={handleAdicionar} className="filter-bar" style={{ marginBottom: 0 }}>
              <div className="filter-field">
                <label>Código</label>
                <input
                  type="text"
                  value={novaConta.codigo}
                  onChange={(e) => setNovaConta((v) => ({ ...v, codigo: e.target.value }))}
                  placeholder="4.7.03.001.999"
                />
              </div>
              <div className="filter-field" style={{ minWidth: 220 }}>
                <label>Nome</label>
                <input
                  type="text"
                  value={novaConta.nome}
                  onChange={(e) => setNovaConta((v) => ({ ...v, nome: e.target.value }))}
                  placeholder="Nome da conta"
                />
              </div>
              <div className="filter-field" style={{ minWidth: 220 }}>
                <label>Linha do P&amp;L</label>
                <input
                  type="text"
                  value={novaConta.linha_pl}
                  onChange={(e) => setNovaConta((v) => ({ ...v, linha_pl: e.target.value }))}
                  placeholder="Despesas > Personnel Costs"
                />
              </div>
              <div className="filter-field">
                <label>Categoria</label>
                <input
                  type="text"
                  value={novaConta.categoria}
                  onChange={(e) => setNovaConta((v) => ({ ...v, categoria: e.target.value }))}
                  placeholder="Salários+Encargos"
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={salvandoNova}>
                {salvandoNova ? 'Salvando…' : 'Adicionar'}
              </button>
            </form>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Contas Cadastradas</h2>
              <p>{loading ? 'Carregando…' : `${contas.length} conta(s)`}</p>
            </div>
            <ImportExportBar
              nomeArquivo="contas-contabeis"
              colunas={COLUNAS}
              dados={contas}
              onImportarLinha={handleImportarLinha}
              onImportConcluido={handleImportConcluido}
              showToast={showToast}
            />
          </div>
          <div className="panel-body">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nome</th>
                    <th>Linha do P&amp;L</th>
                    <th>Categoria</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {contas.map((conta) =>
                    editandoId === conta.id ? (
                      <tr key={conta.id}>
                        <td><input type="text" value={rascunhoEdicao.codigo} onChange={(e) => setRascunhoEdicao((v) => ({ ...v, codigo: e.target.value }))} /></td>
                        <td><input type="text" value={rascunhoEdicao.nome} onChange={(e) => setRascunhoEdicao((v) => ({ ...v, nome: e.target.value }))} /></td>
                        <td><input type="text" value={rascunhoEdicao.linha_pl} onChange={(e) => setRascunhoEdicao((v) => ({ ...v, linha_pl: e.target.value }))} /></td>
                        <td><input type="text" value={rascunhoEdicao.categoria} onChange={(e) => setRascunhoEdicao((v) => ({ ...v, categoria: e.target.value }))} /></td>
                        <td className="text-right">
                          <button className="btn btn-success btn-sm" onClick={() => salvarEdicao(conta.id)}>Salvar</button>{' '}
                          <button className="btn btn-secondary btn-sm" onClick={cancelarEdicao}>Cancelar</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={conta.id}>
                        <td>{conta.codigo}</td>
                        <td>{conta.nome}</td>
                        <td className="text-muted">{conta.linha_pl}</td>
                        <td><span className="pill despesa">{conta.categoria}</span></td>
                        <td className="text-right">
                          <button className="btn btn-ghost btn-sm" onClick={() => iniciarEdicao(conta)}>Editar</button>{' '}
                          <button className="btn btn-danger btn-sm" onClick={() => handleExcluir(conta)}>Excluir</button>
                        </td>
                      </tr>
                    )
                  )}
                  {!loading && contas.length === 0 && (
                    <tr>
                      <td colSpan={5} className="empty-hint">Nenhuma conta cadastrada ainda.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
