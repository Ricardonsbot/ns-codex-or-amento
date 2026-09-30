import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { registrarErro } from '../lib/logErroData'

const ToastContext = createContext(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const showToast = useCallback((message, type = 'info') => {
    const id = ++idRef.current
    setToasts((list) => [...list, { id, message, type }])
    setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id))
    }, 2800)
    // Todo toast de erro vira uma linha no log — é o mesmo texto que a
    // pessoa já viu na tela, só que guardado pra copiar e colar numa IA
    // depois, sem precisar reproduzir o problema de novo.
    if (type === 'error') registrarErro({ mensagem: message, contexto: window.location.pathname })
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div id="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
