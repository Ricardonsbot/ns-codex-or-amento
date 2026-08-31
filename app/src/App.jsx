import { Routes, Route } from 'react-router-dom'
import ToastProvider from './components/ToastProvider'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Cadastros from './pages/Cadastros'
import ContasContabeis from './pages/cadastros/ContasContabeis'
import Indices from './pages/cadastros/Indices'
import CadastroSimples from './pages/cadastros/CadastroSimples'
import Receita from './pages/orcamento/Receita'
import Despesa from './pages/orcamento/Despesa'
import Capex from './pages/orcamento/Capex'
import Aprovacoes from './pages/Aprovacoes'
import Relatorios from './pages/Relatorios'
import BudgetSettings from './pages/BudgetSettings'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/orcamento/receita" element={<Receita />} />
        <Route path="/orcamento/despesa" element={<Despesa />} />
        <Route path="/orcamento/capex" element={<Capex />} />
        <Route path="/aprovacoes" element={<Aprovacoes />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/cadastros" element={<Cadastros />} />
        <Route path="/cadastros/contas" element={<ContasContabeis />} />
        <Route path="/cadastros/indices" element={<Indices />} />
        <Route path="/cadastros/:slug" element={<CadastroSimples />} />
        <Route path="/budget-settings" element={<BudgetSettings />} />
      </Routes>
    </ToastProvider>
  )
}
