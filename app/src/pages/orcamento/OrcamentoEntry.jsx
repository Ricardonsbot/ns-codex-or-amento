import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { useToast } from '../../components/ToastProvider'
import { fetchBUs, fetchTorres, fetchEmpresas } from '../../lib/dashboardData'
import { fetchContas } from '../../lib/contasData'
import {
  fetchVersaoAtual,
  fetchLancamentos,
  createLancamento,
  updateLancamento,
  deleteLancamento,
  salvarValoresMensais,
  duplicarLancamento,
} from '../../lib/lancamentosData'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function paddedValores(lista) {
  const porMes = new Map((lista ?? []).map((v) => [v.mes, Number(v.valor)]))
  return Array.from({ length: 12 }, (_, i) => porMes.get(i + 1) ?? 0)
}

function formatMil(v) {
  return `R$ ${(v / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} mil`
}

export default function OrcamentoEntry({ tipo, titulo, sinal, rotulo, corClasse }) {
  const showToast = useToast()

  const [versaoAtual, setVersaoAtual] = useState(null)
  const [bus, setBus] = useState([])
  const [torres, setTorres] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [contas, setContas] = useState([])

  const [selectedBuId, setSelectedBuId] = useState('')
  const [selectedTorreId, setSelectedTorreId] = useState('')
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('')

  const [linhas, setLinhas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregarBase() {
      try {
        const [va, busData, torresData, empresasData, contasData] = await Promise.all([
          fetchVersaoAtual(),
          fetchBUs(),
          fetchTorres(),
          fetchEmpresas(),
          fetchContas(),
        ])
        setVersaoAtual(va)
        setBus(busData)
        setTorres(torresData)
        setEmpresas(empresasData)
        setContas(contasData)
      } catch (err) {
        showToast(`Erro ao carregar dados base: ${err.message}`, 'error')
      } finally {
        setLoading(false)
      }
    }
    carregarBase()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!versaoAtual?.versao) return
    carregarLinhas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versaoAtual, selectedBuId, selectedTorreId, selectedEmpresaId])

  async function carregarLinhas() {
    try {
      const dados = await fetchLancamentos({
        tipo,
        versaoId: versaoAtual.versao.id,
        buId: selectedBuId || null,
        torreId: selectedTorreId || null,
        empresaId: selectedEmpresaId || null,
      })
      setLinhas(dados.map((l) => ({ ...l, valores: paddedValores(l.lancamento_valor_mensal) })))
    } catch (err) {
      showToast(`Erro ao carregar lançamentos: ${err.message}`, 'error')
    }
  }

  const torresDisponiveis = selectedBuId ? torres.filter((t) => t.bu_id === selectedBuId) : torres
  const empresasDisponiveis = selectedTorreId
    ? empresas.filter((e) => e.torre_id === selectedTorreId)
    : selectedBuId
    ? empresas.filter((e) => e.bu_id === selectedBuId)
    : empresas

  async function handleAdicionarLinha() {
    if (!selectedBuId) {
      showToast('Selecione ao menos a BU antes de adicionar uma conta.', 'warning')
      return
    }
    try {
      const criado = await createLancamento({
        tipo,
        versao_id: versaoAtual.versao.id,
        bu_id: selectedBuId,
        torre_id: selectedTorreId || null,
        empresa_id: selectedEmpresaId || null,
        conta_id: contas[0]?.id ?? null,
      })
      setLinhas((atual) => [...atual, { ...criado, valores: Array(12).fill(0) }])
    } catch (err) {
      showToast(`Erro ao adicionar linha: ${err.message}`, 'error')
    }
  }

  function atualizarCampoLocal(id, campo, valor) {
    setLinhas((atual) => atual.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)))
  }

  function atualizarValorMes(id, mesIndex, valor) {
    setLinhas((atual) =>
      atual.map((l) => {
        if (l.id !== id) return l
        const valores = [...l.valores]
        valores[mesIndex] = Number(valor)
        return { ...l, valores }
      })
    )
  }

  function handleReplicarJaneiro(id) {
    setLinhas((atual) => atual.map((l) => (l.id === id ? { ...l, valores: Array(12).fill(l.valores[0]) } : l)))
  }

  async function handleSalvarLinha(linha) {
    try {
      const contaSelecionada = contas.find((c) => c.id === linha.conta_id)
      const atualizado = await updateLancamento(linha.id, {
        conta_id: linha.conta_id,
        descricao: linha.descricao,
        centro_de_custo: linha.centro_de_custo,
        fornecedor: linha.fornecedor,
        obs: linha.obs,
      })
      await salvarValoresMensais(linha.id, linha.valores)
      setLinhas((atual) =>
        atual.map((l) => (l.id === linha.id ? { ...l, ...atualizado, conta: contaSelecionada ?? atualizado.conta, valores: linha.valores } : l))
      )
      showToast('Lançamento salvo.', 'success')
    } catch (err) {
      showToast(`Erro ao salvar: ${err.message}`, 'error')
    }
  }

  async function handleDuplicar(linha) {
    try {
      const nova = await duplicarLancamento(linha)
      setLinhas((atual) => [...atual, { ...nova, valores: linha.valores }])
      showToast('Linha duplicada.', 'success')
    } catch (err) {
      showToast(`Erro ao duplicar: ${err.message}`, 'error')
    }
  }

  async function handleExcluir(linha) {
    if (!window.confirm(`Remover o lançamento de "${linha.conta?.nome ?? 'conta'}"?`)) return
    try {
      await deleteLancamento(linha.id)
      setLinhas((atual) => atual.filter((l) => l.id !== linha.id))
      showToast('Lançamento removido.', 'success')
    } catch (err) {
      showToast(`Erro ao remover: ${err.message}`, 'error')
    }
  }

  const totalGeral = linhas.reduce((acc, l) => acc + l.valores.reduce((a, v) => a + v, 0), 0)

  if (loading) {
    return (
      <Layout>
        <div className="content">
          <div className="empty-hint">Carregando…</div>
        </div>
      </Layout>
    )
  }

  if (!versaoAtual?.versao) {
    return (
      <Layout>
        <header className="topbar">
          <div className="topbar-title"><h1>{titulo}</h1></div>
        </header>
        <div className="content">
          <div className="empty-hint">
            Nenhum ciclo com versão ativa encontrado. Crie um Ciclo (com versão Original) em Budget - Settings antes de lançar valores.
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>{titulo} <span className={`pill ${corClasse}`}>{sinal} {rotulo}</span></h1>
          <p>Selecione BU/Torre/Empresa e edite a grade de {rotulo.toLowerCase()} — os valores são salvos por linha.</p>
        </div>
      </header>

      <div className="content">
        <div className="version-status-bar">
          <div className="version-status-item">
            <span className="version-status-label">Versão em edição</span>
            <span className="version-status-value">
              Ciclo {versaoAtual.ciclo.ano} · {versaoAtual.versao.nome} <span className={`pill tipo-${versaoAtual.versao.tipo}`}>{versaoAtual.versao.tipo === 'original' ? 'Original' : 'Revisão'}</span>
            </span>
          </div>
        </div>

        <div className="panel launch-context-panel">
          <div className="panel-header">
            <div>
              <h2>Contexto do Lançamento</h2>
              <p>Selecione BU, Torre e Empresa antes de editar a grade abaixo</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="filter-bar" style={{ marginBottom: 0, border: 'none', padding: 0 }}>
              <div className="filter-field">
                <label>BU</label>
                <select
                  value={selectedBuId}
                  onChange={(e) => {
                    setSelectedBuId(e.target.value)
                    setSelectedTorreId('')
                    setSelectedEmpresaId('')
                  }}
                >
                  <option value="">Todas as BUs</option>
                  {bus.map((bu) => (
                    <option key={bu.id} value={bu.id}>{bu.nome}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label>Torre</label>
                <select
                  value={selectedTorreId}
                  onChange={(e) => {
                    setSelectedTorreId(e.target.value)
                    setSelectedEmpresaId('')
                  }}
                >
                  <option value="">Todas as Torres</option>
                  {torresDisponiveis.map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label>Empresa</label>
                <select value={selectedEmpresaId} onChange={(e) => setSelectedEmpresaId(e.target.value)}>
                  <option value="">Todas as Empresas</option>
                  {empresasDisponiveis.map((e) => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Lançamento de {rotulo}</h2>
              <p>Valores mensais em R$. Clique em 💾 para salvar a linha após editar.</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleAdicionarLinha}>+ Adicionar Conta</button>
          </div>
          <div className="panel-body table-wrap">
            <table className="entry-grid">
              <thead>
                <tr>
                  <th>Conta</th>
                  <th>Descrição</th>
                  <th>Centro de Custo</th>
                  <th>Fornecedor</th>
                  <th>Obs</th>
                  {MESES.map((m) => (
                    <th key={m} className="text-right month-col">{m}</th>
                  ))}
                  <th className="text-right">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <tr key={linha.id}>
                    <td style={{ minWidth: 200 }}>
                      <select value={linha.conta_id ?? ''} onChange={(e) => atualizarCampoLocal(linha.id, 'conta_id', e.target.value)}>
                        {contas.map((c) => (
                          <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>
                        ))}
                      </select>
                    </td>
                    <td><input type="text" value={linha.descricao ?? ''} onChange={(e) => atualizarCampoLocal(linha.id, 'descricao', e.target.value)} /></td>
                    <td><input type="text" value={linha.centro_de_custo ?? ''} onChange={(e) => atualizarCampoLocal(linha.id, 'centro_de_custo', e.target.value)} /></td>
                    <td><input type="text" value={linha.fornecedor ?? ''} onChange={(e) => atualizarCampoLocal(linha.id, 'fornecedor', e.target.value)} /></td>
                    <td><input type="text" value={linha.obs ?? ''} onChange={(e) => atualizarCampoLocal(linha.id, 'obs', e.target.value)} /></td>
                    {linha.valores.map((v, i) => (
                      <td key={i} className="month-col">
                        <input type="number" value={v} onChange={(e) => atualizarValorMes(linha.id, i, e.target.value)} />
                      </td>
                    ))}
                    <td className="text-right total-cell">{formatMil(linha.valores.reduce((a, b) => a + b, 0))}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" title="Salvar" onClick={() => handleSalvarLinha(linha)}>💾</button>
                      <button className="btn btn-ghost btn-sm" title="Replicar Para Todos os Meses" onClick={() => handleReplicarJaneiro(linha.id)}>⇥</button>
                      <button className="btn btn-ghost btn-sm" title="Duplicar" onClick={() => handleDuplicar(linha)}>⧉</button>
                      <button className="btn btn-ghost btn-sm" title="Remover" onClick={() => handleExcluir(linha)}>🗑</button>
                    </td>
                  </tr>
                ))}
                {linhas.length === 0 && (
                  <tr>
                    <td colSpan={20} className="empty-hint">Nenhum lançamento nesse recorte ainda. Clique em "+ Adicionar Conta".</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={17}>Total Geral</td>
                  <td className="text-right">{formatMil(totalGeral)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}
