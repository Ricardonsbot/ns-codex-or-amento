import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useToast } from '../components/ToastProvider'
import { fetchTodasVersoesPendentes, ativarVersao, reprovarVersao } from '../lib/ciclosData'

export default function Aprovacoes() {
  const showToast = useToast()
  const [pendentes, setPendentes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)
    try {
      setPendentes(await fetchTodasVersoesPendentes())
    } catch (err) {
      showToast(`Erro ao carregar pendências: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleAprovar(versao) {
    try {
      await ativarVersao(versao.id, versao.ciclo_id)
      setPendentes((atual) => atual.filter((v) => v.id !== versao.id))
      showToast(`"${versao.nome}" aprovada e ativada.`, 'success')
    } catch (err) {
      showToast(`Erro ao aprovar: ${err.message}`, 'error')
    }
  }

  async function handleReprovar(versao) {
    if (!window.confirm(`Reprovar "${versao.nome}"? A área precisará revisar e submeter novamente.`)) return
    try {
      await reprovarVersao(versao.id)
      setPendentes((atual) => atual.filter((v) => v.id !== versao.id))
      showToast(`"${versao.nome}" reprovada.`, 'warning')
    } catch (err) {
      showToast(`Erro ao reprovar: ${err.message}`, 'error')
    }
  }

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Aprovações</h1>
          <p>Versões de orçamento em rascunho aguardando decisão</p>
        </div>
      </header>

      <div className="content">
        <div className="proto-banner">
          ⓘ Aprovar ativa a versão para o ciclo (encerrando a versão ativa anterior). Reprovar marca a versão como reprovada — a área cria uma nova versão para revisar.
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Pendentes de Aprovação</h2>
              <p>{loading ? 'Carregando…' : `${pendentes.length} versão(ões) em rascunho`}</p>
            </div>
          </div>
          <div className="panel-body table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ciclo</th>
                  <th>Versão</th>
                  <th>Tipo</th>
                  <th>Criada em</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendentes.map((versao) => (
                  <tr key={versao.id}>
                    <td>Ciclo {versao.ciclo?.ano}</td>
                    <td>{versao.nome}</td>
                    <td><span className={`pill tipo-${versao.tipo}`}>{versao.tipo === 'original' ? 'Original' : 'Revisão'}</span></td>
                    <td>{new Date(versao.criada_em).toLocaleDateString('pt-BR')}</td>
                    <td className="text-right">
                      <button className="btn btn-success btn-sm" onClick={() => handleAprovar(versao)}>Aprovar</button>{' '}
                      <button className="btn btn-danger btn-sm" onClick={() => handleReprovar(versao)}>Reprovar</button>
                    </td>
                  </tr>
                ))}
                {!loading && pendentes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-hint">Nenhuma versão pendente de aprovação no momento.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}
