import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useToast } from '../../components/ToastProvider'
import { fetchAll, criar, atualizar, remover } from '../../lib/cadastroSimplesData'
import { CADASTROS_SIMPLES } from '../../lib/cadastrosSimplesConfig'

function campoVazio(campos) {
  return Object.fromEntries(campos.map((c) => [c.key, '']))
}

export default function CadastroSimples() {
  const { slug } = useParams()
  const config = CADASTROS_SIMPLES[slug]
  const campos = config?.campos ?? []
  const showToast = useToast()

  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [novo, setNovo] = useState(campoVazio(campos))
  const [salvandoNovo, setSalvandoNovo] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [rascunho, setRascunho] = useState(campoVazio(campos))

  useEffect(() => {
    if (!config) return
    setNovo(campoVazio(campos))
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  async function carregar() {
    setLoading(true)
    try {
      setItens(await fetchAll(config.tabela))
    } catch (err) {
      showToast(`Erro ao carregar ${config.titulo.toLowerCase()}: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdicionar(e) {
    e.preventDefault()
    const faltando = campos.filter((c) => c.obrigatorio && !novo[c.key]?.trim())
    if (faltando.length) {
      showToast(`Preencha: ${faltando.map((c) => c.label).join(', ')}`, 'warning')
      return
    }
    setSalvandoNovo(true)
    try {
      const criado = await criar(config.tabela, novo)
      setItens((atual) => [...atual, criado])
      setNovo(campoVazio(campos))
      showToast('Cadastrado com sucesso.', 'success')
    } catch (err) {
      showToast(`Erro ao cadastrar: ${err.message}`, 'error')
    } finally {
      setSalvandoNovo(false)
    }
  }

  function iniciarEdicao(item) {
    setEditandoId(item.id)
    setRascunho(Object.fromEntries(campos.map((c) => [c.key, item[c.key] ?? ''])))
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setRascunho(campoVazio(campos))
  }

  async function salvarEdicao(id) {
    try {
      const atualizado = await atualizar(config.tabela, id, rascunho)
      setItens((atual) => atual.map((i) => (i.id === id ? atualizado : i)))
      cancelarEdicao()
      showToast('Atualizado.', 'success')
    } catch (err) {
      showToast(`Erro ao atualizar: ${err.message}`, 'error')
    }
  }

  async function handleExcluir(item) {
    const rotulo = item.nome ?? item.codigo ?? item.id
    if (!window.confirm(`Excluir "${rotulo}"?`)) return
    try {
      await remover(config.tabela, item.id)
      setItens((atual) => atual.filter((i) => i.id !== item.id))
      showToast('Excluído.', 'success')
    } catch (err) {
      showToast(`Erro ao excluir: ${err.message}`, 'error')
    }
  }

  if (!config) {
    return (
      <Layout>
        <div className="content">
          <div className="empty-hint">Cadastro não encontrado.</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>{config.titulo}</h1>
        </div>
        <div className="topbar-actions">
          <Link to="/cadastros" className="btn btn-secondary">← Voltar aos Cadastros</Link>
        </div>
      </header>

      <div className="content">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Novo registro</h2>
            </div>
          </div>
          <div className="panel-body">
            <form onSubmit={handleAdicionar} className="filter-bar" style={{ marginBottom: 0 }}>
              {campos.map((campo) => (
                <div className="filter-field" key={campo.key} style={{ minWidth: 180 }}>
                  <label>{campo.label}</label>
                  {campo.tipo === 'select' ? (
                    <select value={novo[campo.key]} onChange={(e) => setNovo((v) => ({ ...v, [campo.key]: e.target.value }))}>
                      <option value="">—</option>
                      {campo.opcoes.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" value={novo[campo.key]} onChange={(e) => setNovo((v) => ({ ...v, [campo.key]: e.target.value }))} />
                  )}
                </div>
              ))}
              <button className="btn btn-primary" type="submit" disabled={salvandoNovo}>
                {salvandoNovo ? 'Salvando…' : 'Adicionar'}
              </button>
            </form>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Registros</h2>
              <p>{loading ? 'Carregando…' : `${itens.length} registro(s)`}</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {campos.map((c) => (
                      <th key={c.key}>{c.label}</th>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item) =>
                    editandoId === item.id ? (
                      <tr key={item.id}>
                        {campos.map((c) => (
                          <td key={c.key}>
                            <input
                              type="text"
                              value={rascunho[c.key]}
                              onChange={(e) => setRascunho((v) => ({ ...v, [c.key]: e.target.value }))}
                            />
                          </td>
                        ))}
                        <td className="text-right">
                          <button className="btn btn-success btn-sm" onClick={() => salvarEdicao(item.id)}>Salvar</button>{' '}
                          <button className="btn btn-secondary btn-sm" onClick={cancelarEdicao}>Cancelar</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={item.id}>
                        {campos.map((c) => (
                          <td key={c.key}>{item[c.key]}</td>
                        ))}
                        <td className="text-right">
                          <button className="btn btn-ghost btn-sm" onClick={() => iniciarEdicao(item)}>Editar</button>{' '}
                          <button className="btn btn-danger btn-sm" onClick={() => handleExcluir(item)}>Excluir</button>
                        </td>
                      </tr>
                    )
                  )}
                  {!loading && itens.length === 0 && (
                    <tr>
                      <td colSpan={campos.length + 1} className="empty-hint">Nenhum registro cadastrado ainda.</td>
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
