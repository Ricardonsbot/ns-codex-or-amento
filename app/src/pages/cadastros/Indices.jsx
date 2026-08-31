import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useToast } from '../../components/ToastProvider'
import { fetchIndices, createIndice, updateIndice, deleteIndice, fetchValoresMensais, salvarValoresMensais } from '../../lib/indicesData'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function formatPct(v) {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

export default function Indices() {
  const showToast = useToast()
  const [indices, setIndices] = useState([])
  const [loading, setLoading] = useState(true)
  const [criando, setCriando] = useState(false)

  const [selecionadoId, setSelecionadoId] = useState(null)
  const [valores, setValores] = useState(null)
  const [salvandoValores, setSalvandoValores] = useState(false)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)
    try {
      const dados = await fetchIndices()
      setIndices(dados)
      if (dados.length && selecionadoId === null) {
        selecionar(dados[0].id)
      }
    } catch (err) {
      showToast(`Erro ao carregar índices: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function selecionar(id) {
    setSelecionadoId(id)
    try {
      setValores(await fetchValoresMensais(id))
    } catch (err) {
      showToast(`Erro ao carregar valores mensais: ${err.message}`, 'error')
    }
  }

  async function handleNovoIndice() {
    setCriando(true)
    try {
      const criado = await createIndice({ tipo: 'IGP-M', aplicacao: 'ambos', ano: new Date().getFullYear(), status: 'rascunho' })
      setIndices((atual) => [criado, ...atual])
      selecionar(criado.id)
      showToast('Índice criado.', 'success')
    } catch (err) {
      showToast(`Erro ao criar índice: ${err.message}`, 'error')
    } finally {
      setCriando(false)
    }
  }

  async function handleCampoChange(indice, campo, valor) {
    setIndices((atual) => atual.map((i) => (i.id === indice.id ? { ...i, [campo]: valor } : i)))
    try {
      await updateIndice(indice.id, { [campo]: valor })
    } catch (err) {
      showToast(`Erro ao atualizar índice: ${err.message}`, 'error')
    }
  }

  async function handleExcluir(indice) {
    if (!window.confirm(`Excluir o índice "${indice.tipo} · ${indice.ano}"?`)) return
    try {
      await deleteIndice(indice.id)
      setIndices((atual) => atual.filter((i) => i.id !== indice.id))
      if (selecionadoId === indice.id) {
        setSelecionadoId(null)
        setValores(null)
      }
      showToast('Índice excluído.', 'success')
    } catch (err) {
      showToast(`Erro ao excluir índice: ${err.message}`, 'error')
    }
  }

  function handleValorChange(i, valor) {
    setValores((atual) => atual.map((v, idx) => (idx === i ? Number(valor) : v)))
  }

  function handleReplicarJaneiro() {
    setValores((atual) => atual.map(() => atual[0]))
  }

  async function handleSalvarValores() {
    setSalvandoValores(true)
    try {
      await salvarValoresMensais(selecionadoId, valores)
      const acumulado = valores.reduce((acc, v) => acc + v, 0)
      setIndices((atual) => atual.map((i) => (i.id === selecionadoId ? { ...i, acumulado } : i)))
      showToast('Valores mensais salvos.', 'success')
    } catch (err) {
      showToast(`Erro ao salvar valores: ${err.message}`, 'error')
    } finally {
      setSalvandoValores(false)
    }
  }

  const selecionado = indices.find((i) => i.id === selecionadoId)

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Índices</h1>
          <p>Índices de reajuste (IGP-M, INPC, IPCA...) para Revenue e Expenses</p>
        </div>
        <div className="topbar-actions">
          <Link to="/cadastros" className="btn btn-secondary">← Voltar aos Cadastros</Link>
        </div>
      </header>

      <div className="content">
        <div className="proto-banner">
          ⓘ Cadastre índices e informe a % mês a mês. Essa % alimentaria o cálculo de reajuste de contratos de Receita e Despesa.
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Índices Cadastrados</h2>
              <p>Clique em uma linha para ver/editar os valores mensais abaixo</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleNovoIndice} disabled={criando}>
              {criando ? 'Criando…' : '+ Novo Índice'}
            </button>
          </div>
          <div className="panel-body table-wrap">
            <table className="entry-grid">
              <thead>
                <tr>
                  <th>Índice</th>
                  <th>Aplicação</th>
                  <th>Ano</th>
                  <th className="text-right">Acumulado 12m</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {indices.map((indice) => (
                  <tr
                    key={indice.id}
                    className={indice.id === selecionadoId ? 'selected' : ''}
                    data-drill-target
                    onClick={() => selecionar(indice.id)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <select value={indice.tipo} onChange={(e) => handleCampoChange(indice, 'tipo', e.target.value)}>
                        <option>IGP-M</option>
                        <option>INPC</option>
                        <option>IPCA</option>
                        <option>SELIC</option>
                        <option>Outro</option>
                      </select>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select value={indice.aplicacao} onChange={(e) => handleCampoChange(indice, 'aplicacao', e.target.value)}>
                        <option value="receita">Receita</option>
                        <option value="despesa">Despesa</option>
                        <option value="ambos">Ambos</option>
                      </select>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        value={indice.ano}
                        style={{ width: 90 }}
                        onChange={(e) => handleCampoChange(indice, 'ano', Number(e.target.value))}
                      />
                    </td>
                    <td className="text-right total-cell">{formatPct(indice.acumulado)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select value={indice.status} onChange={(e) => handleCampoChange(indice, 'status', e.target.value)}>
                        <option value="ativo">Ativo</option>
                        <option value="rascunho">Rascunho</option>
                      </select>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-sm" title="Remover" onClick={() => handleExcluir(indice)}>🗑</button>
                    </td>
                  </tr>
                ))}
                {!loading && indices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-hint">Nenhum índice cadastrado ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selecionado && valores && (
          <div className="panel aux-panel">
            <div className="panel-header">
              <div>
                <h2>Valores Mensais</h2>
                <p>Índice selecionado: <strong>{selecionado.tipo} · {selecionado.aplicacao} · {selecionado.ano}</strong></p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleSalvarValores} disabled={salvandoValores}>
                {salvandoValores ? 'Salvando…' : 'Salvar Valores'}
              </button>
            </div>
            <div className="panel-body table-wrap">
              <table className="entry-grid">
                <thead>
                  <tr>
                    {MESES.map((mes) => (
                      <th key={mes} className="text-right month-col">{mes}</th>
                    ))}
                    <th className="text-right">Acumulado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {valores.map((v, i) => (
                      <td key={i} className="month-col">
                        <input type="number" step="0.01" value={v} onChange={(e) => handleValorChange(i, e.target.value)} />
                      </td>
                    ))}
                    <td className="text-right total-cell">{formatPct(valores.reduce((acc, v) => acc + v, 0))}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" title="Replicar Jan para todos os meses" onClick={handleReplicarJaneiro}>⇥</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
