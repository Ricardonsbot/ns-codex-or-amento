import { Routes, Route } from 'react-router-dom'
import ToastProvider from './components/ToastProvider'
import AuthProvider from './components/AuthProvider'
import RequireAuth from './components/RequireAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Cadastros from './pages/Cadastros'
import ContasContabeis from './pages/cadastros/ContasContabeis'
import Indices from './pages/cadastros/Indices'
import EstruturaOrganizacional from './pages/cadastros/EstruturaOrganizacional'
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
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/orcamento/receita" element={<RequireAuth><Receita /></RequireAuth>} />
          <Route path="/orcamento/despesa" element={<RequireAuth><Despesa /></RequireAuth>} />
          <Route path="/orcamento/capex" element={<RequireAuth><Capex /></RequireAuth>} />
          <Route path="/aprovacoes" element={<RequireAuth><Aprovacoes /></RequireAuth>} />
          <Route path="/relatorios" element={<RequireAuth><Relatorios /></RequireAuth>} />
          <Route path="/cadastros" element={<RequireAuth><Cadastros /></RequireAuth>} />
          <Route path="/cadastros/contas" element={<RequireAuth><ContasContabeis /></RequireAuth>} />
          <Route path="/cadastros/indices" element={<RequireAuth><Indices /></RequireAuth>} />
          <Route path="/cadastros/estrutura-organizacional" element={<RequireAuth><EstruturaOrganizacional /></RequireAuth>} />
          <Route path="/cadastros/:slug" element={<RequireAuth><CadastroSimples /></RequireAuth>} />
          <Route path="/budget-settings" element={<RequireAuth><BudgetSettings /></RequireAuth>} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  )
}
