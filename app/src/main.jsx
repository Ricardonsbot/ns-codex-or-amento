import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ErroNaTela from './components/ErroNaTela.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ErroNaTela>
        <App />
      </ErroNaTela>
    </BrowserRouter>
  </StrictMode>,
)
