import Layout from '../components/Layout'

export default function EmConstrucao({ titulo }) {
  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>{titulo}</h1>
        </div>
      </header>
      <div className="content">
        <div className="proto-banner">
          🚧 Esta tela ainda não foi migrada do protótipo estático para o React — peça para migrarmos ela quando quiser.
        </div>
      </div>
    </Layout>
  )
}
