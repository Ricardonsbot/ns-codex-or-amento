import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export default function RequireAuth({ children }) {
  const { sessao, carregando } = useAuth()

  if (carregando) return null
  if (!sessao) return <Navigate to="/login" replace />
  return children
}
