import { useState } from 'react'
import Icone from './Icone'
import { listarErros } from '../lib/logErroData'
import { useMostrarIdTela } from '../lib/identificadorTela'

/**
 * O ícone de log de erros: só o ícone, canto da tela, sem rótulo — não é
 * pra chamar atenção, é pra estar lá quando alguém precisar. Todo toast de
 * erro já vira uma linha aqui (ver ToastProvider); este botão só lê o que
 * já foi guardado.
 *
 * "Copiar" pega o texto inteiro do erro, pronto pra colar numa IA — é pra
 * isso que o log existe: não pra reproduzir o problema de novo, só pra
 * levar o erro de onde ele aconteceu até quem vai olhar.
 */
export default function LogErrosBotao() {
  const [aberto, setAberto] = useState(false)
  const [erros, setErros] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [copiadoId, setCopiadoId] = useState(null)
  const [mostrarId, alternarMostrarId] = useMostrarIdTela()

  async function abrir() {
    setAberto(true)
    setCarregando(true)
    try {
      setErros(await listarErros())
    } catch {
      setErros([])
    } finally {
      setCarregando(false)
    }
  }

  async function copiar(erro) {
    const texto = `[${new Date(erro.criado_em).toLocaleString('pt-BR')}]${erro.contexto ? ` ${erro.contexto}` : ''}${
      erro.usuario_email ? ` · ${erro.usuario_email}` : ''
    }\n${erro.mensagem}`
    try {
      await navigator.clipboard.writeText(texto)
      setCopiadoId(erro.id)
      setTimeout(() => setCopiadoId((atual) => (atual === erro.id ? null : atual)), 1500)
    } catch {
      // Clipboard bloqueado: sem feedback, mas o texto continua na tela pra selecionar na mão.
    }
  }

  return (
    <>
      <button
        className="log-erros-botao"
        type="button"
        onClick={abrir}
        title="Log de erros"
        aria-label="Log de erros"
      >
        <Icone nome="logErro" tamanho={18} />
      </button>

      {aberto && (
        <div className="modal-overlay open" role="dialog" aria-modal="true" aria-label="Log de erros">
          <div className="modal log-erros-modal">
            <div className="modal-header">
              <h3>Log de erros</h3>
              <button className="modal-close" type="button" onClick={() => setAberto(false)} aria-label="Fechar">
                ×
              </button>
            </div>
            <div className="modal-body">
              <label className="log-erros-toggle-id">
                <input type="checkbox" checked={mostrarId} onChange={alternarMostrarId} />
                Mostrar o ID da tela, pra apontar onde está o bug
              </label>

              {carregando ? (
                <div className="empty-hint">Carregando…</div>
              ) : erros.length === 0 ? (
                <div className="empty-hint">Nenhum erro registrado ainda.</div>
              ) : (
                <ul className="log-erros-lista">
                  {erros.map((erro) => (
                    <li key={erro.id} className="log-erros-item">
                      <div className="log-erros-item-topo">
                        <span className="log-erros-data">
                          {new Date(erro.criado_em).toLocaleString('pt-BR')}
                        </span>
                        {erro.contexto && <span className="log-erros-contexto">{erro.contexto}</span>}
                        {erro.usuario_email && <span className="log-erros-usuario">{erro.usuario_email}</span>}
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() => copiar(erro)}
                          style={{ marginLeft: 'auto' }}
                        >
                          {copiadoId === erro.id ? 'Copiado ✓' : 'Copiar'}
                        </button>
                      </div>
                      <div className="log-erros-mensagem">{erro.mensagem}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
