import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/ToastProvider'

export default function Login() {
  const navigate = useNavigate()
  const showToast = useToast()
  const [email, setEmail] = useState('emerson.nakamura@nstech.com.br')
  const [senha, setSenha] = useState('')

  function handleEntrar() {
    showToast('Login simulado com sucesso. Redirecionando...', 'success')
    setTimeout(() => navigate('/'), 900)
  }

  function handleSso() {
    showToast('Autenticação simulada via SSO Corporativo. Redirecionando...', 'info')
    setTimeout(() => navigate('/'), 900)
  }

  return (
    <div className="login-shell">
      <div className="login-brand-header">
        <div className="logo-mark">NS</div>
        <strong>NS Codex</strong>
        <span>Orçamento Corporativo · BU · Torres · Corporate</span>
      </div>

      <div className="login-card">
        <h1>Bem-vindo de volta</h1>
        <p className="login-subtitle">Entre com sua conta corporativa para acessar o ciclo de orçamento.</p>

        <div className="proto-banner" style={{ marginBottom: 18 }}>
          ⓘ Login ainda simulado — a integração com Supabase Auth entra numa próxima etapa.
        </div>

        <div className="login-form">
          <div className="field-group">
            <label htmlFor="login-email">E-mail corporativo</label>
            <input
              type="text"
              id="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome.sobrenome@empresa.com"
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
            />
          </div>

          <div className="login-form-row">
            <label className="remember">
              <input type="checkbox" defaultChecked style={{ width: 'auto' }} />
              Manter conectado
            </label>
            <a href="#" onClick={(e) => { e.preventDefault(); showToast('Fluxo de recuperação de senha simulado', 'info') }}>
              Esqueci minha senha
            </a>
          </div>

          <button className="btn btn-primary btn-block" onClick={handleEntrar}>
            Entrar →
          </button>

          <div className="login-divider">ou</div>

          <button className="btn btn-sso" onClick={handleSso}>
            🪟 Entrar com conta Microsoft
          </button>
        </div>

        <p className="login-footer-note">
          Acesso restrito a colaboradores autorizados. Em caso de dúvida, contate o time de FP&amp;A Corporate.
        </p>
      </div>
    </div>
  )
}
