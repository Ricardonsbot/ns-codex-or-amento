import { useEffect, useState } from 'react'
import { fetchCiclosResultado, versaoReferencia } from '../lib/resultadoData'
import { createCiclo } from '../lib/ciclosData'
import { useToast } from './ToastProvider'

/**
 * Antes o ciclo e a versão eram descobertos sozinhos, pelo ano escrito no
 * cabeçalho da planilha. Agora é a pessoa que escolhe — este modal é o
 * primeiro passo do upload: só depois de nomear o template e confirmar o
 * ciclo/versão é que o campo de arquivo libera.
 *
 * A lista de versões só mostra rascunho/ativa ("disponível para
 * lançamento" em Ciclos & Versões) — encerrada ou reprovada não aceita
 * gravação, então nem aparece aqui para não deixar escolher um destino
 * que a conferência vai recusar depois.
 */
export default function SeletorDestinoTemplate({ onCancelar, onConfirmar }) {
  const showToast = useToast()
  const [ciclos, setCiclos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [criandoCiclo, setCriandoCiclo] = useState(false)
  const [nomeTemplate, setNomeTemplate] = useState('')
  const [cicloId, setCicloId] = useState('')
  const [versaoId, setVersaoId] = useState('')

  async function carregar() {
    setCarregando(true)
    try {
      const dados = await fetchCiclosResultado()
      setCiclos(dados)
      return dados
    } catch (err) {
      showToast(`Erro ao carregar ciclos: ${err.message}`, 'error')
      return []
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar().then((dados) => {
      const ciclo = dados[0]
      if (!ciclo) return
      setCicloId(ciclo.id)
      const disponiveis = (ciclo.versao ?? []).filter((v) => v.status === 'rascunho' || v.status === 'ativa')
      setVersaoId(versaoReferencia({ versao: disponiveis })?.id ?? disponiveis[0]?.id ?? '')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ciclo = ciclos.find((c) => c.id === cicloId) ?? null
  const versoesDisponiveis = (ciclo?.versao ?? []).filter((v) => v.status === 'rascunho' || v.status === 'ativa')
  const versao = versoesDisponiveis.find((v) => v.id === versaoId) ?? null

  function handleTrocarCiclo(novoCicloId) {
    setCicloId(novoCicloId)
    const novoCiclo = ciclos.find((c) => c.id === novoCicloId)
    const disponiveis = (novoCiclo?.versao ?? []).filter((v) => v.status === 'rascunho' || v.status === 'ativa')
    setVersaoId(versaoReferencia({ versao: disponiveis })?.id ?? disponiveis[0]?.id ?? '')
  }

  async function handleNovoCiclo() {
    const ano = window.prompt('Ano do novo ciclo:', String(new Date().getFullYear() + 1))
    if (!ano) return
    setCriandoCiclo(true)
    try {
      await createCiclo(Number(ano))
      const dados = await carregar()
      const novoCiclo = dados.find((c) => c.ano === Number(ano))
      if (novoCiclo) handleTrocarCiclo(novoCiclo.id)
      showToast(`Ciclo ${ano} criado com a versão Original.`, 'success')
    } catch (err) {
      showToast(`Erro ao criar ciclo: ${err.message}`, 'error')
    } finally {
      setCriandoCiclo(false)
    }
  }

  const podeConfirmar = Boolean(nomeTemplate.trim() && ciclo && versao)

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" aria-label="Destino do template">
      <div className="modal">
        <div className="modal-header">
          <h3>Antes de subir o template</h3>
          <button className="modal-close" type="button" onClick={onCancelar} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="field-group">
            <label htmlFor="nome-template">Nome do template</label>
            <input
              id="nome-template"
              type="text"
              placeholder="Ex.: FP&A Setembro"
              value={nomeTemplate}
              onChange={(e) => setNomeTemplate(e.target.value)}
              autoFocus
            />
          </div>

          <div className="field-group">
            <label htmlFor="ciclo-destino">Ciclo</label>
            {carregando ? (
              <span className="text-muted">Carregando…</span>
            ) : ciclos.length === 0 ? (
              <span className="text-muted">Nenhum ciclo cadastrado ainda.</span>
            ) : (
              <select id="ciclo-destino" value={cicloId} onChange={(e) => handleTrocarCiclo(e.target.value)}>
                {ciclos.map((c) => (
                  <option key={c.id} value={c.id}>
                    Ciclo {c.ano}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="field-group">
            <label htmlFor="versao-destino">Versão</label>
            {ciclo && versoesDisponiveis.length === 0 ? (
              <span className="text-muted">
                Nenhuma versão disponível para lançamento neste ciclo — crie ou reabra uma em Ciclos &amp; Versões.
              </span>
            ) : (
              <select id="versao-destino" value={versaoId} onChange={(e) => setVersaoId(e.target.value)} disabled={!ciclo}>
                {versoesDisponiveis.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button className="btn btn-ghost btn-sm" type="button" onClick={handleNovoCiclo} disabled={criandoCiclo} style={{ alignSelf: 'flex-start' }}>
            {criandoCiclo ? 'Criando…' : '+ Novo ciclo'}
          </button>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={onCancelar}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={!podeConfirmar}
            onClick={() => onConfirmar({ nomeTemplate: nomeTemplate.trim(), ciclo, versao })}
          >
            Continuar para o arquivo
          </button>
        </div>
      </div>
    </div>
  )
}
