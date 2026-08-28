import { Routes, Route } from 'react-router-dom'
import ToastProvider from './components/ToastProvider'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import EmConstrucao from './pages/EmConstrucao'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/orcamento/receita" element={<EmConstrucao titulo="Orçamento de Receita — (+) Revenue" />} />
        <Route path="/orcamento/despesa" element={<EmConstrucao titulo="Orçamento de Despesa — (−) Expenses" />} />
        <Route path="/orcamento/capex" element={<EmConstrucao titulo="Orçamento de Capex — (−) Capex" />} />
        <Route path="/aprovacoes" element={<EmConstrucao titulo="Aprovações" />} />
        <Route path="/relatorios" element={<EmConstrucao titulo="Relatórios" />} />
        <Route path="/cadastros" element={<EmConstrucao titulo="Cadastros" />} />
        <Route path="/budget-settings" element={<EmConstrucao titulo="Budget - Settings" />} />
      </Routes>
    </ToastProvider>
  )
}
