import { Navigate } from 'react-router-dom'

// Capex virou uma aba dentro de Expenses — quem tinha o link antigo salvo
// (ou clica num atalho anterior) cai direto na aba certa em vez de um 404.
export default function Capex() {
  return <Navigate to="/orcamento/despesa?modo=capex" replace />
}
