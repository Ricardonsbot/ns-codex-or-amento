import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useToast } from '../components/ToastProvider'
import {
  fetchCiclos,
  createCiclo,
  updateCicloStatus,
  fetchVersoes,
  criarVersaoRevisao,
  ativarVersao,
  encerrarVersao,
  reprovarVersao,
  duplicarVersao,
} from '../lib/ciclosData'

const STATUS_CICLO = {
  em_elaboracao: { label: 'Em elaboração', classe: 'status-rascunho' },
  ativo: { label: 'Ativo', classe: 'status-aprovado' },
  encerrado: { label: 'Encerrado', classe: 'status-rascunho' },
}

const STATUS_VERSAO = {
  rascunho: { label: 'Rascunho', classe: 'status-rascunho' },
  ativa: { label: 'Ativa', classe: 'status-aprovado' },
  encerrada: { label: 'Encerrada', classe: 'status-rascunho' },
  reprovada: { label: 'Reprovada', classe: 'status-reprovado' },
}

export default function BudgetSettings() {
  const showToast = useToast()
  const [ciclos, setCiclos] = useState([])
  const [loading, setLoading] = useState(true)
  const [criandoCiclo, setCriandoCiclo] = useState(false)

  const [cicloSelecionado, setCicloSelecionado] = useState(null)
  const [versoes, setVersoes] = useState([])

  useEffect(() => {
    carregarCiclos()
  }, [])

  async function carregarCiclos() {
    setLoading(true)
    try {
      const dados = await fetchCiclos()
      setCiclos(dados)
      if (dados.length && !cicloSelecionado) {
        selecionarCiclo(dados[0])
      }
    } catch (err) {
      showToast(`Erro ao carregar ciclos: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function selecionarCiclo(ciclo) {
    setCicloSelecionado(ciclo)
    try {
      setVersoes(await fetchVersoes(ciclo.id))
    } catch (err) {
      showToast(`Erro ao carregar versões: ${err.message}`, 'error')
    }
  }

  async function handleNovoCiclo() {
    const ano = window.prompt('Ano do novo ciclo:', String(new Date().getFullYear() + 1))
    if (!ano) return
    setCriandoCiclo(true)
    try {
      await createCiclo(Number(ano))
      await carregarCiclos()
      showToast(`Ciclo ${ano} criado com versão Original.`, 'success')
    } catch (err) {
      showToast(`Erro ao criar ciclo: ${err.message}`, 'error')
    } finally {
      setCriandoCiclo(false)
    }
  }

  async function handleEncerrarCiclo(ciclo) {
    if (!window.confirm(`Encerrar o Ciclo ${ciclo.ano}? Ele deixará de ser editável.`)) return
    try {
      await updateCicloStatus(ciclo.id, 'encerrado')
      await carregarCiclos()
      showToast('Ciclo encerrado.', 'success')
    } catch (err) {
      showToast(`Erro ao encerrar ciclo: ${err.message}`, 'error')
    }
  }

  async function handleNovaVersao() {
    const versaoBase = versoes.find((v) => v.status === 'ativa') ?? versoes[0]
    const nome = window.prompt('Nome da nova versão (Revisão):', `Revisão ${versoes.length + 1}`)
    if (!nome) return
    try {
      await criarVersaoRevisao(cicloSelecionado.id, versaoBase?.id ?? null, nome)
      setVersoes(await fetchVersoes(cicloSelecionado.id))
      await carregarCiclos()
      showToast('Nova versão criada.', 'success')
    } catch (err) {
      showToast(`Erro ao criar versão: ${err.message}`, 'error')
    }
  }

  async function handleAtivar(versao) {
    try {
      await ativarVersao(versao.id, cicloSelecionado.id)
      setVersoes(await fetchVersoes(cicloSelecionado.id))
      await carregarCiclos()
      showToast(`"${versao.nome}" ativada.`, 'success')
    } catch (err) {
      showToast(`Erro ao ativar versão: ${err.message}`, 'error')
    }
  }

  async function handleEncerrarVersao(versao) {
    try {
      await encerrarVersao(versao.id)
      setVersoes(await fetchVersoes(cicloSelecionado.id))
      showToast(`"${versao.nome}" encerrada.`, 'success')
    } catch (err) {
      showToast(`Erro ao encerrar versão: ${err.message}`, 'error')
    }
  }

  async function handleReprovar(versao) {
    if (!window.confirm(`Marcar "${versao.nome}" como reprovada?`)) return
    try {
      await reprovarVersao(versao.id)
      setVersoes(await fetchVersoes(cicloSelecionado.id))
      showToast(`"${versao.nome}" reprovada.`, 'warning')
    } catch (err) {
      showToast(`Erro ao reprovar versão: ${err.message}`, 'error')
    }
  }

  async function handleDuplicar(versao) {
    try {
      await duplicarVersao(versao)
      setVersoes(await fetchVersoes(cicloSelecionado.id))
      await carregarCiclos()
      showToast(`"${versao.nome}" duplicada (com todos os lançamentos).`, 'success')
    } catch (err) {
      showToast(`Erro ao duplicar versão: ${err.message}`, 'error')
    }
  }

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Budget - Settings</h1>
          <p>Novo Ciclo → Versão do Ciclo → Encerrar Versão ou Ciclo</p>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-primary" onClick={handleNovoCiclo} disabled={criandoCiclo}>
            {criandoCiclo ? 'Criando…' : '+ Novo Ciclo'}
          </button>
        </div>
      </header>

      <div className="content">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Ciclos</h2>
              <p>Um Ciclo por ano de orçamento — clique em um para ver suas versões</p>
            </div>
          </div>
          <div className="panel-body table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ciclo</th>
                  <th>Status</th>
                  <th>Versão Ativa</th>
                  <th className="text-right">Nº Versões</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ciclos.map((ciclo) => (
                  <tr
                    key={ciclo.id}
                    className={cicloSelecionado?.id === ciclo.id ? 'selected' : ''}
                    style={{ cursor: 'pointer' }}
                    onClick={() => selecionarCiclo(ciclo)}
                  >
                    <td>Ciclo {ciclo.ano}</td>
                    <td>
                      <span className={`badge ${STATUS_CICLO[ciclo.status]?.classe}`}>
                        <span className="badge-dot"></span>{STATUS_CICLO[ciclo.status]?.label ?? ciclo.status}
                      </span>
                    </td>
                    <td>{ciclo.versaoAtivaNome}</td>
                    <td className="text-right">{ciclo.nVersoes}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {ciclo.status !== 'encerrado' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleEncerrarCiclo(ciclo)}>Encerrar Ciclo</button>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && ciclos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-hint">Nenhum ciclo cadastrado ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {cicloSelecionado && (
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Versões — Ciclo {cicloSelecionado.ano}</h2>
                <p>Histórico de versões deste ciclo, da mais recente para a mais antiga</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handleNovaVersao}>+ Nova Versão</button>
            </div>
            <div className="panel-body table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Versão</th>
                    <th>Tipo</th>
                    <th>Baseada em</th>
                    <th>Criada em</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {versoes.map((versao) => (
                    <tr key={versao.id}>
                      <td>{versao.nome}</td>
                      <td><span className={`pill tipo-${versao.tipo}`}>{versao.tipo === 'original' ? 'Original' : 'Revisão'}</span></td>
                      <td>{versao.baseada_em?.nome ?? '—'}</td>
                      <td>{new Date(versao.criada_em).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <span className={`badge ${STATUS_VERSAO[versao.status]?.classe}`}>
                          <span className="badge-dot"></span>{STATUS_VERSAO[versao.status]?.label ?? versao.status}
                        </span>
                      </td>
                      <td>
                        {versao.status !== 'ativa' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleAtivar(versao)}>Ativar</button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDuplicar(versao)}>Duplicar</button>
                        {versao.status === 'ativa' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleEncerrarVersao(versao)}>Encerrar</button>
                        )}
                        {versao.status === 'rascunho' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleReprovar(versao)}>Reprovar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {versoes.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty-hint">Nenhuma versão cadastrada ainda.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
