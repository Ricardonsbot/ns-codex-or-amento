import { useEffect, useRef, useState } from 'react'

/**
 * Botão de exportar com as opções de formato. Cada opção é
 * { valor, rotulo, descricao }; `onEscolher(valor)` monta a exportação.
 *
 * Existe porque exportar passou a ter mais de um formato — o quadro da tela e
 * a base empilhada — e dois botões lado a lado não diriam qual é qual.
 */
export default function MenuExportar({ opcoes, onEscolher, desabilitado, ocupado }) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef(null)

  useEffect(() => {
    if (!aberto) return undefined
    const fora = (e) => {
      if (!caixa.current?.contains(e.target)) setAberto(false)
    }
    const esc = (e) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  return (
    <div className="menu-exportar" ref={caixa}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        aria-expanded={aberto}
        aria-haspopup="menu"
        disabled={desabilitado || ocupado}
        onClick={() => setAberto((x) => !x)}
      >
        {ocupado ? 'Preparando…' : '⭳ Exportar ▾'}
      </button>
      {aberto && (
        <div className="menu-exportar-lista" role="menu">
          {opcoes.map((o) => (
            <button
              key={o.valor}
              type="button"
              role="menuitem"
              onClick={() => {
                setAberto(false)
                onEscolher(o.valor)
              }}
            >
              <strong>{o.rotulo}</strong>
              {o.descricao && <span>{o.descricao}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
