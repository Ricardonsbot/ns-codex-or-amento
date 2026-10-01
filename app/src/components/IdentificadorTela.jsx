import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { idDaTela, useMostrarIdTela } from '../lib/identificadorTela'

/**
 * Etiqueta com o ID da tela atual, pra falar pra uma IA qual tela tem o bug
 * em vez de descrever o caminho do menu. Só aparece com o interruptor do
 * Log de erros ligado — no dia a dia ninguém precisa disso na tela.
 */
export default function IdentificadorTela() {
  const [ativo] = useMostrarIdTela()
  const location = useLocation()
  const [copiado, setCopiado] = useState(false)

  if (!ativo) return null

  const id = idDaTela(location.pathname, location.search)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(id)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // Clipboard bloqueado: o ID já está visível pra copiar na mão.
    }
  }

  return (
    <button type="button" className="id-tela-badge" onClick={copiar} title="Copiar ID da tela">
      {copiado ? 'copiado ✓' : id}
    </button>
  )
}
