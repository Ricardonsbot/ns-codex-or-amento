import { useState } from 'react'

/**
 * O botão que recolhe um painel, no canto esquerdo do título.
 *
 * Quem esconde o corpo é o CSS, pelo `aria-expanded` deste botão — não há
 * classe sendo posta em pai nenhum. Assim o estado que o leitor de tela lê e
 * o estado que a tela mostra são a mesma coisa, e não duas que podem
 * discordar.
 *
 * O que está recolhido é preferência de quem olha, não dado da ferramenta:
 * fica no localStorage do navegador e não vai para o banco. Armazenamento
 * bloqueado não pode derrubar a tela, então toda leitura e escrita é
 * protegida — sem ele, o painel só volta aberto na próxima visita.
 */
const CHAVE = 'nsplanner.paineis.recolhidos'

function lerRecolhidos() {
  try {
    const bruto = window.localStorage.getItem(CHAVE)
    return new Set(bruto ? JSON.parse(bruto) : [])
  } catch {
    return new Set()
  }
}

export default function BotaoRecolher({ chave, rotulo }) {
  const [aberto, setAberto] = useState(() => !lerRecolhidos().has(chave))

  function alternar() {
    const recolhidos = lerRecolhidos()
    if (aberto) recolhidos.add(chave)
    else recolhidos.delete(chave)
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify([...recolhidos]))
    } catch {
      // Sem localStorage a escolha vale só nesta visita — e tudo bem.
    }
    setAberto(!aberto)
  }

  const oQue = rotulo ? ` ${rotulo}` : ''
  return (
    <button
      type="button"
      className="painel-recolher"
      onClick={alternar}
      aria-expanded={aberto}
      aria-label={aberto ? `Recolher${oQue}` : `Expandir${oQue}`}
      title={aberto ? 'Recolher' : 'Expandir'}
    >
      {/* Sempre o mesmo triângulo: quem vira é o CSS, pelo aria-expanded. */}
      <span aria-hidden="true">▾</span>
    </button>
  )
}
