import { createContext, useContext, useEffect, useState } from 'react'
import { obterSessaoAtual, aoMudarAutenticacao } from '../lib/authData'

const AuthContext = createContext(null)

export default function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    obterSessaoAtual()
      .then(setSessao)
      .finally(() => setCarregando(false))

    const cancelar = aoMudarAutenticacao((novaSessao) => setSessao(novaSessao))
    return cancelar
  }, [])

  return <AuthContext.Provider value={{ sessao, carregando }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
