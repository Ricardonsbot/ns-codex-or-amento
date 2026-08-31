import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useToast } from '../components/ToastProvider'
import { useAuth } from '../components/AuthProvider'
import { entrar } from '../lib/authData'

export default function Login() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { sessao, carregando } = useAuth()
  const [email, setEmail] = useState('dev@nstech.com.br')
  const [senha, setSenha] = useState('123456')
  const [entrando, setEntrando] = useState(false)

  if (!carregando && sessao) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleEntrar(e) {
    e.preventDefault()
    setEntrando(true)
    try {
      await entrar(email, senha)
      showToast('Login realizado com sucesso.', 'success')
      navigate('/dashboard')
    } catch (err) {
      showToast(`Não foi possível entrar: ${err.message}`, 'error')
    } finally {
      setEntrando(false)
    }
  }

  function handleSso() {
    showToast('Login via SSO Corporativo ainda não está disponível.', 'info')
  }

  return (
    <div className="login-shell">
      <div className="login-brand-header">
        <div className="logo-mark">NS</div>
        <strong><span className="brand-ns">NS</span> <span className="brand-rest">Budget</span></strong>
        <span>Ferramenta Orçamentária Nstech</span>
      </div>

      <div className="login-card">
        <h1>Bem-vindo de volta</h1>
        <p className="login-subtitle">Entre com sua conta corporativa para acessar o ciclo de orçamento.</p>

        <div className="proto-banner" style={{ marginBottom: 18 }}>
          ⓘ Acesso restrito a pessoas já cadastradas — não há autocadastro nesta tela.
        </div>

        <form className="login-form" onSubmit={handleEntrar}>
          <div className="field-group">
            <label htmlFor="login-email">E-mail corporativo</label>
            <input
              type="email"
              id="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome.sobrenome@empresa.com"
              required
            />
          </div>

          <div className="field-group">
            <label htmlFor="login-senha">Senha</label>
            <input
              type="password"
              id="login-senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="login-form-row">
            <label className="remember">
              <input type="checkbox" defaultChecked style={{ width: 'auto' }} />
              Manter conectado
            </label>
            <a href="#" onClick={(e) => { e.preventDefault(); showToast('Fale com o time de FP&A Corporate para redefinir sua senha.', 'info') }}>
              Esqueci minha senha
            </a>
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={entrando}>
            {entrando ? 'Entrando…' : 'Entrar →'}
          </button>

          <div className="login-divider">ou</div>

          <button className="btn btn-sso" type="button" onClick={handleSso}>
            🪟 Entrar com conta Microsoft
          </button>
        </form>

        <p className="login-footer-note">
          Acesso restrito a colaboradores autorizados. Em caso de dúvida, contate o time de FP&amp;A Corporate.
        </p>
      </div>
    </div>
  )
}
