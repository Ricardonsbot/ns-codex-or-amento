import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useToast } from '../components/ToastProvider'
import { fetchAnos, fetchBUs, fetchTorres, fetchBridgeSummary, computeBridge } from '../lib/dashboardData'
import BotaoUnidade from '../components/BotaoUnidade'
import { useUnidade } from '../components/UnidadeProvider'
import { fetchResultado, fetchCiclosResultado, versaoReferencia } from '../lib/resultadoData'
import { bigNumbers } from '../lib/quadrosResultado'
import Indicadores from '../components/Indicadores'

// Escolha de quem está olhando, não dado do orçamento: fica no navegador.
const CHAVE_ACESSO_RAPIDO = 'ns-budget:acesso-rapido-aberto'
const lerAberto = () => {
  try {
    return localStorage.getItem(CHAVE_ACESSO_RAPIDO) !== 'false'
  } catch {
    return true
  }
}

export default function Dashboard() {
  const showToast = useToast()
  const { comMoeda } = useUnidade()

  const [bus, setBus] = useState([])
  const [torres, setTorres] = useState([])

  const [selectedAno, setSelectedAno] = useState(null)
  const [selectedBuId, setSelectedBuId] = useState('')
  const [selectedTorreId, setSelectedTorreId] = useState('')

  const [bridge, setBridge] = useState(computeBridge({ receita: 0, despesa: 0, capex: 0 }))
  const [loading, setLoading] = useState(true)
  const [acessoAberto, setAcessoAberto] = useState(lerAberto)
  const [ciclos, setCiclos] = useState([])
  const [indicadores, setIndicadores] = useState(null)

  function alternarAcesso() {
    setAcessoAberto((aberto) => {
      try {
        localStorage.setItem(CHAVE_ACESSO_RAPIDO, String(!aberto))
      } catch {
        // navegador sem armazenamento: a escolha só não sobrevive ao reload
      }
      return !aberto
    })
  }

  useEffect(() => {
    async function carregarFiltros() {
      try {
        const [anosData, busData, torresData, ciclosData] = await Promise.all([
          fetchAnos(),
          fetchBUs(),
          fetchTorres(),
          fetchCiclosResultado(),
        ])
        setBus(busData)
        setTorres(torresData)
        setCiclos(ciclosData)
        setSelectedAno(anosData[0] ?? null)
      } catch (err) {
        showToast(`Erro ao carregar filtros do Supabase: ${err.message}`, 'error')
      }
    }
    carregarFiltros()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedAno === null) return
    async function aplicarFiltros() {
      setLoading(true)
      try {
        const resumo = await fetchBridgeSummary({
          ano: selectedAno,
          buId: selectedBuId || null,
          torreId: selectedTorreId || null,
        })
        setBridge(computeBridge(resumo))
      } catch (err) {
        showToast(`Erro ao consultar lançamentos: ${err.message}`, 'error')
      } finally {
        setLoading(false)
      }
    }
    aplicarFiltros()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAno, selectedBuId, selectedTorreId])

  // Os mesmos big numbers do Resultado, no recorte dos filtros do Dashboard:
  // ano inteiro (FY) da versão de referência do ciclo, contra o ano anterior.
  const ciclo = ciclos.find((c) => c.ano === selectedAno) ?? null
  const versao = versaoReferencia(ciclo)
  const versaoLy = versaoReferencia(ciclos.find((c) => c.ano === selectedAno - 1))

  useEffect(() => {
    if (!versao) {
      setIndicadores(null)
      return
    }
    let cancelado = false
    ;(async () => {
      try {
        const filtros = { buId: selectedBuId || null, torreId: selectedTorreId || null, empresaId: null }
        const [a, l] = await Promise.all([
          fetchResultado(versao.id, filtros),
          versaoLy ? fetchResultado(versaoLy.id, filtros) : Promise.resolve(null),
        ])
        if (!cancelado) setIndicadores(bigNumbers({ dados: a, comp: null, ly: l, mes: 12 }))
      } catch (err) {
        if (!cancelado) {
          setIndicadores(null)
          showToast(`Erro ao montar os indicadores: ${err.message}`, 'error')
        }
      }
    })()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao?.id, versaoLy?.id, selectedBuId, selectedTorreId])

  const torresDisponiveis = selectedBuId ? torres.filter((t) => t.bu_id === selectedBuId) : torres

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Dashboard</h1>
          <p>Ciclo de Orçamento {selectedAno ?? '—'} · Consolidado Corporate</p>
        </div>
      </header>

      <div className="content">
        <div className="proto-banner">
          ⓘ Fase 2 da migração para React — filtros e resumo do orçamento já consultam o Supabase (dados reais de estrutura organizacional, plano de contas e lançamentos).
        </div>

        <div className="filter-bar">
          <div className="filter-field">
            <label>BU</label>
            <select
              value={selectedBuId}
              onChange={(e) => {
                setSelectedBuId(e.target.value)
                setSelectedTorreId('')
              }}
            >
              <option value="">Todas as BUs</option>
              {bus.map((bu) => (
                <option key={bu.id} value={bu.id}>
                  {bu.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label>Torre</label>
            <select value={selectedTorreId} onChange={(e) => setSelectedTorreId(e.target.value)}>
              <option value="">Todas as Torres</option>
              {torresDisponiveis.map((torre) => (
                <option key={torre.id} value={torre.id}>
                  {torre.nome}
                </option>
              ))}
            </select>
          </div>
          <BotaoUnidade />
          {loading && <span className="text-muted">Atualizando…</span>}
        </div>

        {indicadores && <Indicadores itens={indicadores} />}

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Acesso Rápido</h2>
              <p>Navegue pelas funcionalidades do orçamento sem sair do menu</p>
            </div>
            <button
              type="button"
              className="panel-toggle"
              aria-expanded={acessoAberto}
              title={acessoAberto ? 'Recolher o acesso rápido' : 'Mostrar o acesso rápido'}
              onClick={() => alternarAcesso()}
            >
              {acessoAberto ? '▾ Recolher' : '▸ Mostrar'}
            </button>
          </div>
          <div className="panel-body" hidden={!acessoAberto}>
            <div className="action-strip">
              <Link to="/orcamento/despesa">
                <div className="hub-card hub-inserir">
                  <div className="hub-icon">✎</div>
                  <h3>Inserir</h3>
                  <p>Lançar valores de Receita, Despesa e Capex.</p>
                  <div className="hub-cta">Novo lançamento →</div>
                </div>
              </Link>
              <Link to="/cadastros">
                <div className="hub-card hub-cadastrar">
                  <div className="hub-icon">👤</div>
                  <h3>Cadastrar</h3>
                  <p>Usuários, contas, índices, layouts e mais.</p>
                  <div className="hub-cta">Abrir cadastros →</div>
                </div>
              </Link>
              <div className="hub-card hub-exportar" onClick={() => showToast('Exportação simulada gerada', 'info')}>
                <div className="hub-icon">⭳</div>
                <h3>Exportar</h3>
                <p>Baixar o resumo do orçamento do ciclo atual.</p>
                <div className="hub-cta">Exportar dados →</div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Resumo do Orçamento — Revenue → EBITDA after Capex</h2>
              <p>Ciclo {selectedAno ?? '—'} · dados reais do Supabase (R$ milhões)</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="bridge-chart">
              <div className="bridge-col">
                <div className="bridge-value">{comMoeda(bridge.receita)}</div>
                <div className="bridge-track"><div className="bridge-bar receita" style={{ bottom: `${bridge.bars.receita.bottom}%`, height: `${bridge.bars.receita.height}%` }} /></div>
                <div className="bridge-label"><span className="bridge-sign">(+)</span>Revenue</div>
              </div>
              <div className="bridge-connector">
                <div className="bridge-value">&nbsp;</div>
                <div className="bridge-connector-track"><div className="bridge-connector-line" style={{ bottom: `${bridge.bars.receita.height}%` }} /></div>
                <div className="bridge-label">&nbsp;</div>
              </div>
              <div className="bridge-col">
                <div className="bridge-value">{comMoeda(-Math.abs(bridge.despesa))}</div>
                <div className="bridge-track"><div className="bridge-bar despesa" style={{ bottom: `${bridge.bars.despesa.bottom}%`, height: `${bridge.bars.despesa.height}%` }} /></div>
                <div className="bridge-label"><span className="bridge-sign">(−)</span>Expenses</div>
              </div>
              <div className="bridge-connector">
                <div className="bridge-value">&nbsp;</div>
                <div className="bridge-connector-track"><div className="bridge-connector-line" style={{ bottom: `${bridge.bars.ebitda.height}%` }} /></div>
                <div className="bridge-label">&nbsp;</div>
              </div>
              <div className="bridge-col">
                <div className="bridge-value">{comMoeda(bridge.ebitda)}</div>
                <div className="bridge-track"><div className="bridge-bar subtotal" style={{ bottom: `${bridge.bars.ebitda.bottom}%`, height: `${bridge.bars.ebitda.height}%` }} /></div>
                <div className="bridge-label">EBITDA</div>
              </div>
              <div className="bridge-connector">
                <div className="bridge-value">&nbsp;</div>
                <div className="bridge-connector-track"><div className="bridge-connector-line" style={{ bottom: `${bridge.bars.ebitda.height}%` }} /></div>
                <div className="bridge-label">&nbsp;</div>
              </div>
              <div className="bridge-col">
                <div className="bridge-value">{comMoeda(-Math.abs(bridge.capex))}</div>
                <div className="bridge-track"><div className="bridge-bar capex" style={{ bottom: `${bridge.bars.capex.bottom}%`, height: `${bridge.bars.capex.height}%` }} /></div>
                <div className="bridge-label"><span className="bridge-sign">(−)</span>Capex</div>
              </div>
              <div className="bridge-connector">
                <div className="bridge-value">&nbsp;</div>
                <div className="bridge-connector-track"><div className="bridge-connector-line" style={{ bottom: `${bridge.bars.ebitdaAfterCapex.height}%` }} /></div>
                <div className="bridge-label">&nbsp;</div>
              </div>
              <div className="bridge-col">
                <div className="bridge-value">{comMoeda(bridge.ebitdaAfterCapex)}</div>
                <div className="bridge-track"><div className="bridge-bar final" style={{ bottom: `${bridge.bars.ebitdaAfterCapex.bottom}%`, height: `${bridge.bars.ebitdaAfterCapex.height}%` }} /></div>
                <div className="bridge-label">EBITDA after Capex</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
