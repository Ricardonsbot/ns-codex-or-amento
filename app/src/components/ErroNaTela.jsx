import { Component } from 'react'

/**
 * Quando uma tela quebra ao desenhar, o React desmonta tudo e sobra uma página
 * em branco — sem nada que diga o quê nem onde. Isto pega o erro e mostra a
 * mensagem, com o trecho do código, e um botão para voltar. Quem reporta o
 * problema passa a ter o que copiar.
 */
export default class ErroNaTela extends Component {
  constructor(props) {
    super(props)
    this.state = { erro: null, onde: '' }
  }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro, info) {
    console.error('Erro ao desenhar a tela:', erro, info?.componentStack)
    this.setState({ onde: info?.componentStack ?? '' })
  }

  render() {
    const { erro, onde } = this.state
    if (!erro) return this.props.children
    return (
      <div style={{ padding: 32, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
        <h2 style={{ marginTop: 0 }}>Esta tela encontrou um erro</h2>
        <p>Copie o texto abaixo e mande para quem mantém a ferramenta. Os dados gravados não foram afetados.</p>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            background: '#f4f4f4',
            border: '1px solid #ddd',
            borderRadius: 6,
            padding: 12,
            fontSize: 12,
            maxHeight: 360,
            overflow: 'auto',
          }}
        >
          {String(erro?.stack || erro)}
          {onde ? `\n\nComponente:${onde.split('\n').slice(0, 8).join('\n')}` : ''}
        </pre>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: '8px 14px', cursor: 'pointer' }}>
          Recarregar a tela
        </button>
      </div>
    )
  }
}
