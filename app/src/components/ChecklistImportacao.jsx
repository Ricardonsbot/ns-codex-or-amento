import { useEffect, useRef } from 'react'
import { checklist, flagDo } from '../lib/importacoesData'

const CORES = { verde: 'Tudo certo', amarelo: 'Passou, mas confira', vermelho: 'Tem pendência' }

/**
 * O checklist do template numa janela: os itens vermelhos (o número sai
 * errado) e os amarelos (entra, mas alguém precisa olhar), pendências
 * primeiro.
 *
 * É janela, e não um bloco na página, porque são onze frases longas: em
 * linha, dentro da tabela do histórico, uma passava por cima da outra.
 *
 * Abre sozinha depois de importar, e pela flag na lista do histórico.
 */
export default function ChecklistImportacao({ registro, escopo, titulo, onFechar }) {
  const fechar = useRef(null)
  useEffect(() => {
    fechar.current?.focus()
    const esc = (e) => e.key === 'Escape' && onFechar?.()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onFechar])

  const itens = checklist(registro, escopo)
  const flag = flagDo(registro, escopo)
  const pendentes = itens.filter((i) => !i.ok)
  const lista = [...pendentes, ...itens.filter((i) => i.ok)]

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" aria-label="Checklist do template">
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h3>Checklist do template</h3>
          <button ref={fechar} className="modal-close" type="button" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="checklist-cabecalho">
            <span className={`flag-template flag-${flag}`}>● {CORES[flag]}</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {titulo ? `${titulo} · ` : ''}
              {pendentes.length
                ? `${pendentes.length} de ${itens.length} itens pedem atenção`
                : `${itens.length} itens conferidos`}
            </span>
          </div>

          <ul className="lista-checklist">
            {lista.map((i) => (
              <li key={i.chave} className={i.ok ? 'ok' : `pendente nivel-${i.nivel}`}>
                <span aria-hidden="true">{i.ok ? '✓' : i.nivel === 'vermelho' ? '✕' : '!'}</span>
                <div>
                  <strong>{i.rotulo}</strong>
                  <span> — {i.detalhe}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
