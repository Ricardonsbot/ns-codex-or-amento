import { useEffect, useState } from 'react'
import { fetchCiclosResultado, versaoReferencia } from '../lib/resultadoData'
import { useToast } from './ToastProvider'

/**
 * Antes o ciclo e a versão eram descobertos sozinhos, pelo ano escrito no
 * cabeçalho da planilha. Agora é a pessoa que escolhe — este modal é o
 * primeiro passo do upload: só depois de confirmar o ciclo/versão é que o
 * campo de arquivo libera.
 *
 * Sem campo de nome: o nome do template é sempre o do próprio arquivo que
 * for escolhido, não precisa digitar de novo. E sem criar ciclo por aqui —
 * isso é coisa de quem tem permissão para mexer em Ciclos & Versões, e só
 * lá; este modal só escolhe entre o que já existe.
 *
 * A lista de versões só mostra rascunho/ativa ("disponível para
 * lançamento" em Ciclos & Versões) — encerrada ou reprovada não aceita
 * gravação, então nem aparece aqui para não deixar escolher um destino
 * que a conferência vai recusar depois. Ciclo e versão já chegam com um
 * padrão escolhido, então o botão libera assim que o modal abre — não
 * depende de digitar nada.
 */
export default function SeletorDestinoTemplate({ onCancelar, onConfirmar }) {
  const showToast = useToast()
  const [ciclos, setCiclos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [cicloId, setCicloId] = useState('')
  const [versaoId, setVersaoId] = useState('')

  useEffect(() => {
    async function carregar() {
      try {
        const dados = await fetchCiclosResultado()
        setCiclos(dados)
        const ciclo = dados[0]
        if (!ciclo) return
        setCicloId(ciclo.id)
        const disponiveis = (ciclo.versao ?? []).filter((v) => v.status === 'rascunho' || v.status === 'ativa')
        setVersaoId(versaoReferencia({ versao: disponiveis })?.id ?? disponiveis[0]?.id ?? '')
      } catch (err) {
        showToast(`Erro ao carregar ciclos: ${err.message}`, 'error')
      } finally {
        setCarregando(false)
      }
    }
    carregar()
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

  const podeConfirmar = Boolean(ciclo && versao)

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
            <label htmlFor="ciclo-destino">Ciclo</label>
            {carregando ? (
              <span className="text-muted">Carregando…</span>
            ) : ciclos.length === 0 ? (
              <span className="text-muted">
                Nenhum ciclo cadastrado ainda — crie um em Ciclos &amp; Versões.
              </span>
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
                Nenhuma versão disponível para lançamento neste ciclo — reabra uma em Ciclos &amp; Versões.
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
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={onCancelar}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={!podeConfirmar}
            onClick={() => onConfirmar({ ciclo, versao })}
          >
            Continuar para o arquivo
          </button>
        </div>
      </div>
    </div>
  )
}
