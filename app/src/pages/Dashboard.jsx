import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useToast } from '../components/ToastProvider'
import { fetchAnos, fetchBUs, fetchTorres, fetchEmpresas } from '../lib/dashboardData'
import BotaoUnidade from '../components/BotaoUnidade'
import FiltroBotoes from '../components/FiltroBotoes'
import { fetchResultado, fetchCiclosResultado, versaoReferencia } from '../lib/resultadoData'
import { bigNumbers } from '../lib/quadrosResultado'
import Indicadores from '../components/Indicadores'
import GraficoLinhas from '../components/GraficoLinhas'
import PainelConsolidacao from '../components/PainelConsolidacao'
import { MESES } from '../lib/demonstrativo'
import { historicoDisponivel, listarImportacoes } from '../lib/importacoesData'

export default function Dashboard() {
  const showToast = useToast()

  const [bus, setBus] = useState([])
  const [torres, setTorres] = useState([])
  const [empresas, setEmpresas] = useState([])

  const [selectedAno, setSelectedAno] = useState(null)
  const [selectedBuId, setSelectedBuId] = useState('')
  const [selectedTorreId, setSelectedTorreId] = useState('')
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('')
  const [selectedVersaoId, setSelectedVersaoId] = useState('')

  const [loading, setLoading] = useState(true)
  const [ciclos, setCiclos] = useState([])
  const [indicadores, setIndicadores] = useState(null)
  // O resultado inteiro, não só os big numbers: o gráfico precisa dos doze
  // meses, e o quadro "Falta" precisa saber quem não lançou.
  const [dados, setDados] = useState(null)
  const [recentes, setRecentes] = useState([])
  const [semHistorico, setSemHistorico] = useState(false)

  useEffect(() => {
    async function carregarFiltros() {
      try {
        const [anosData, busData, torresData, empresasData, ciclosData] = await Promise.all([
          fetchAnos(),
          fetchBUs(),
          fetchTorres(),
          fetchEmpresas(),
          fetchCiclosResultado(),
        ])
        setBus(busData)
        setTorres(torresData)
        setEmpresas(empresasData)
        setCiclos(ciclosData)
        setSelectedAno(anosData[0] ?? null)
      } catch (err) {
        showToast(`Erro ao carregar filtros do Supabase: ${err.message}`, 'error')
      }
    }
    carregarFiltros()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Os últimos templates. Não dependem dos filtros — a lista é de quem subiu
  // arquivo, não de um recorte de BU —, então busca uma vez só.
  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        if (!(await historicoDisponivel())) {
          if (!cancelado) setSemHistorico(true)
          return
        }
        const lista = await listarImportacoes(40)
        // Recusado não subiu para a consolidação: tem painel próprio na
        // Gestão de Importação, e aqui confundiria quem procura o que entrou.
        if (!cancelado) setRecentes(lista.filter((r) => r.resultado !== 'recusado').slice(0, 6))
      } catch {
        if (!cancelado) setSemHistorico(true)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [])

  // Os mesmos big numbers do Resultado, no recorte dos filtros do Dashboard:
  // ano inteiro (FY) da versão escolhida (ou a de referência, por padrão),
  // contra o ano anterior.
  const ciclo = ciclos.find((c) => c.ano === selectedAno) ?? null
  const versoesDisponiveis = [...(ciclo?.versao ?? [])].sort((a, b) =>
    String(a.criada_em).localeCompare(String(b.criada_em))
  )
  const versao = versoesDisponiveis.find((v) => v.id === selectedVersaoId) ?? versaoReferencia(ciclo)
  const versaoLy = versaoReferencia(ciclos.find((c) => c.ano === selectedAno - 1))

  useEffect(() => {
    if (!versao) {
      setIndicadores(null)
      setDados(null)
      setLoading(false)
      return
    }
    let cancelado = false
    setLoading(true)
    ;(async () => {
      try {
        const filtros = {
          buId: selectedBuId || null,
          torreId: selectedTorreId || null,
          empresaId: selectedEmpresaId || null,
        }
        const [a, l] = await Promise.all([
          fetchResultado(versao.id, filtros),
          versaoLy ? fetchResultado(versaoLy.id, filtros) : Promise.resolve(null),
        ])
        if (!cancelado) {
          setDados(a)
          setIndicadores(bigNumbers({ dados: a, comp: null, ly: l, mes: 12 }))
        }
      } catch (err) {
        if (!cancelado) {
          setIndicadores(null)
          setDados(null)
          showToast(`Erro ao montar os indicadores: ${err.message}`, 'error')
        }
      } finally {
        if (!cancelado) setLoading(false)
      }
    })()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao?.id, versaoLy?.id, selectedBuId, selectedTorreId, selectedEmpresaId])

  const torresDisponiveis = selectedBuId ? torres.filter((t) => t.bu_id === selectedBuId) : torres
  // A empresa segue o recorte de cima: escolher a torre encurta a lista.
  const empresasDisponiveis = selectedTorreId
    ? empresas.filter((e) => e.torre_id === selectedTorreId)
    : selectedBuId
    ? empresas.filter((e) => e.bu_id === selectedBuId)
    : empresas

  // Despesa e Capex chegam negativos do demonstrativo, que é a convenção do
  // P&L. No gráfico as três sobem como grandeza: deixar duas vivendo embaixo
  // do zero tornaria a comparação entre elas ilegível.
  const series = dados
    ? [
        { id: 'receita', rotulo: 'Revenue', cor: 'var(--serie-receita)', valores: dados.demo.nr },
        { id: 'despesa', rotulo: 'Expenses', cor: 'var(--serie-despesa)', valores: dados.demo.expenses.map((v) => -v) },
        { id: 'capex', rotulo: 'Capex', cor: 'var(--serie-capex)', valores: dados.demo.capex.map((v) => -v) },
      ]
    : []

  // O GraficoLinhas não desenha série toda zerada — e devolver null deixa
  // um buraco na tela sem dizer por quê. Versão sem lançamento é o estado
  // normal no começo do ciclo, não um defeito: então o lugar do gráfico
  // explica o vazio em vez de sumir.
  const temNumero = series.some((x) => x.valores?.some((v) => v))

  // Em ordem alfabética: quem olha procura a sua empresa, não a maior.
  const faltam = dados
    ? dados.empresas.filter((e) => !e.temLancamento).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    : []

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Dashboard</h1>
        </div>
      </header>

      <div className="content">
        {indicadores && <Indicadores itens={indicadores} />}

        <div className="filter-bar">
          <div className="filter-field">
            <label>BU</label>
            <select
              value={selectedBuId}
              onChange={(e) => {
                setSelectedBuId(e.target.value)
                setSelectedTorreId('')
                setSelectedEmpresaId('')
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
            <select
              value={selectedTorreId}
              onChange={(e) => {
                setSelectedTorreId(e.target.value)
                setSelectedEmpresaId('')
              }}
            >
              <option value="">Todas as Torres</option>
              {torresDisponiveis.map((torre) => (
                <option key={torre.id} value={torre.id}>
                  {torre.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label>Empresa</label>
            <select value={selectedEmpresaId} onChange={(e) => setSelectedEmpresaId(e.target.value)}>
              <option value="">Todas as Empresas</option>
              {empresasDisponiveis.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nome}
                </option>
              ))}
            </select>
          </div>
          {versoesDisponiveis.length > 0 && (
            <FiltroBotoes
              label="Versão"
              valor={versao?.id ?? ''}
              opcoes={versoesDisponiveis.map((v) => ({ valor: v.id, rotulo: v.nome }))}
              onChange={setSelectedVersaoId}
              semTodas
              semCorte
            />
          )}
          <BotaoUnidade />
          {loading && <span className="text-muted">Atualizando…</span>}
        </div>

        {/* O ano de um lado, o andamento do outro: o gráfico diz como está o
            número, os dois quadros dizem se ele já está inteiro. */}
        <div className="dashboard-linha">
          <div className="dashboard-grafico">
            {temNumero ? (
              <GraficoLinhas
                titulo="O ano mês a mês"
                subtitulo="receita, despesa e capex da versão escolhida"
                rotulos={MESES}
                series={series}
              />
            ) : (
              <div className="panel grafico-vazio">
                <div className="panel-header">
                  <div>
                    <h2>O ano mês a mês</h2>
                    <p>receita, despesa e capex da versão escolhida</p>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="empty-hint">
                    {loading
                      ? 'Carregando…'
                      : 'Esta versão ainda não tem lançamento nenhum — o gráfico aparece assim que o primeiro template entrar.'}
                  </div>
                </div>
              </div>
            )}
          </div>
          <PainelConsolidacao
            recentes={recentes}
            historicoIndisponivel={semHistorico}
            faltam={faltam}
            carregando={loading}
          />
        </div>
      </div>
    </Layout>
  )
}
