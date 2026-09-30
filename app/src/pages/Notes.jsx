import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useToast } from '../components/ToastProvider'
import { useAuth } from '../components/AuthProvider'
import { fetchNotas, criarNota, marcarNota, removerNota } from '../lib/notasData'

/**
 * Uma seção do bloco de notas — hoje só "Dev", mas escrita para uma seção
 * nova (Ops, Design...) ser só mais uma chamada deste componente, sem SQL
 * nem código adicional: `secao` é o único parâmetro que muda.
 */
function SecaoNotas({ secao, titulo, descricao }) {
  const showToast = useToast()
  const { sessao } = useAuth()
  const email = sessao?.user?.email

  // null = carregando; [] = carregado e vazio (ou indisponível)
  const [notas, setNotas] = useState(null)
  const [indisponivel, setIndisponivel] = useState(false)
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    const dados = await fetchNotas(secao)
    if (dados === null) {
      setIndisponivel(true)
      setNotas([])
    } else {
      setIndisponivel(false)
      setNotas(dados)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secao])

  async function handleAdicionar(e) {
    e.preventDefault()
    if (!texto.trim()) return
    setSalvando(true)
    try {
      const nova = await criarNota(secao, texto, email)
      setNotas((atual) => [...(atual ?? []), nova])
      setTexto('')
    } catch (err) {
      showToast(`Não consegui salvar a nota: ${err.message}`, 'error')
    } finally {
      setSalvando(false)
    }
  }

  // Otimista: marca na tela na hora, e desfaz se o servidor recusar — uma
  // lista de pendências que trava a cada clique não serve pra anotar rápido.
  async function handleMarcar(nota) {
    const feita = !nota.feita
    setNotas((atual) => atual.map((n) => (n.id === nota.id ? { ...n, feita } : n)))
    try {
      await marcarNota(nota.id, feita, email)
    } catch (err) {
      showToast(`Não consegui atualizar: ${err.message}`, 'error')
      setNotas((atual) => atual.map((n) => (n.id === nota.id ? { ...n, feita: !feita } : n)))
    }
  }

  async function handleRemover(nota) {
    if (!window.confirm(`Remover "${nota.texto}"?`)) return
    const anterior = notas
    setNotas((atual) => atual.filter((n) => n.id !== nota.id))
    try {
      await removerNota(nota.id)
    } catch (err) {
      showToast(`Não consegui remover: ${err.message}`, 'error')
      setNotas(anterior)
    }
  }

  const pendentes = (notas ?? []).filter((n) => !n.feita)
  const feitas = (notas ?? []).filter((n) => n.feita)

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-header">
        <div>
          <h2>{titulo}</h2>
          <p>{descricao}</p>
        </div>
      </div>
      <div className="panel-body">
        {indisponivel && (
          <div className="proto-banner" style={{ marginBottom: 12 }}>
            ⓘ O bloco de notas ainda não está disponível — falta rodar
            supabase/migrations/2026-09-30-notas.sql.
          </div>
        )}

        <form onSubmit={handleAdicionar} className="flex-row" style={{ gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Novo ponto pendente…"
            style={{ flex: 1 }}
            disabled={indisponivel}
          />
          <button
            className="btn btn-primary btn-sm"
            type="submit"
            disabled={salvando || indisponivel || !texto.trim()}
          >
            {salvando ? 'Salvando…' : '+ Adicionar'}
          </button>
        </form>

        {notas === null ? (
          <div className="empty-hint">Carregando…</div>
        ) : !notas.length ? (
          !indisponivel && <div className="empty-hint">Nenhum ponto pendente ainda — comece anotando um acima.</div>
        ) : (
          <ul className="lista-notas">
            {pendentes.map((n) => (
              <li key={n.id} className="nota-item">
                <label>
                  <input type="checkbox" checked={false} onChange={() => handleMarcar(n)} />
                  <span>{n.texto}</span>
                </label>
                <button className="btn btn-ghost btn-sm" title="Remover" onClick={() => handleRemover(n)}>
                  🗑
                </button>
              </li>
            ))}
            {pendentes.length === 0 && feitas.length > 0 && (
              <li className="empty-hint" style={{ padding: '4px 0' }}>
                Nenhum pendente — só o que já foi concluído abaixo.
              </li>
            )}
            {feitas.length > 0 && (
              <>
                <li className="nota-separador">Concluídas ({feitas.length})</li>
                {feitas.map((n) => (
                  <li key={n.id} className="nota-item nota-feita">
                    <label>
                      <input type="checkbox" checked onChange={() => handleMarcar(n)} />
                      <span>{n.texto}</span>
                    </label>
                    <button className="btn btn-ghost btn-sm" title="Remover" onClick={() => handleRemover(n)}>
                      🗑
                    </button>
                  </li>
                ))}
              </>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function Notes() {
  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Notes</h1>
          <p>Bloco de notas do time — vai salvando o que fica pendente, antes do deploy oficial.</p>
        </div>
      </header>

      <div className="content">
        <SecaoNotas
          secao="Dev"
          titulo="Dev"
          descricao="Pontos técnicos pendentes — o que ainda é simulado, o que falta configurar, o que falta decidir."
        />
      </div>
    </Layout>
  )
}
