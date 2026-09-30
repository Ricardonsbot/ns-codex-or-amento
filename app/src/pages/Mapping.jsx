import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import BotaoRecolher from '../components/BotaoRecolher'
import FiltroBotoes from '../components/FiltroBotoes'
import { useToast } from '../components/ToastProvider'
import { fetchAnos, fetchBUs } from '../lib/dashboardData'
import { fetchCiclosResultado, versaoReferencia } from '../lib/resultadoData'
import { fetchMappingEmpresas, CORES_MAPPING } from '../lib/mappingData'

/**
 * O resumo de mapeamento: um quadrado por empresa, colorido pelo que a
 * importação já sabe sobre ela neste ciclo/versão. Não é uma tela de
 * aprovação — quem quer liberar ou devolver um template faz isso onde já
 * fazia (Gestão de Doc › histórico); aqui é só a visão de conjunto, pra
 * saber de relance quantas empresas faltam subir.
 */
export default function Mapping() {
  const showToast = useToast()
  const [ciclos, setCiclos] = useState([])
  const [bus, setBus] = useState([])
  const [selectedAno, setSelectedAno] = useState(null)
  const [selectedVersaoId, setSelectedVersaoId] = useState('')
  const [linhas, setLinhas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregar() {
      try {
        const [anosData, ciclosData, busData] = await Promise.all([fetchAnos(), fetchCiclosResultado(), fetchBUs()])
        setCiclos(ciclosData)
        setBus(busData)
        setSelectedAno(anosData[0] ?? null)
      } catch (err) {
        showToast(`Erro ao carregar ciclos: ${err.message}`, 'error')
      }
    }
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ciclo = ciclos.find((c) => c.ano === selectedAno) ?? null
  const versoesDisponiveis = [...(ciclo?.versao ?? [])].sort((a, b) =>
    String(a.criada_em).localeCompare(String(b.criada_em))
  )
  const versao = versoesDisponiveis.find((v) => v.id === selectedVersaoId) ?? versaoReferencia(ciclo)

  useEffect(() => {
    if (!versao) {
      setLinhas([])
      setLoading(false)
      return
    }
    let cancelado = false
    setLoading(true)
    fetchMappingEmpresas(versao.id)
      .then((dados) => {
        if (!cancelado) setLinhas(dados)
      })
      .catch((err) => {
        if (!cancelado) showToast(`Erro ao montar o mapping: ${err.message}`, 'error')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao?.id])

  const contagem = Object.keys(CORES_MAPPING).reduce((acc, cor) => {
    acc[cor] = linhas.filter((l) => l.cor === cor).length
    return acc
  }, {})

  // Uma seção por BU, cada uma com o título e a grade de quadrados dela —
  // repete pra baixo pra próxima BU. "Sem BU" no fim, só se sobrar alguém.
  const porBu = (() => {
    const mapa = new Map(bus.map((bu) => [bu.id, { bu, itens: [] }]))
    const semBu = { bu: { id: null, nome: 'Sem BU' }, itens: [] }
    for (const linha of linhas) {
      const grupo = mapa.get(linha.empresa.bu_id) ?? semBu
      grupo.itens.push(linha)
    }
    const grupos = [...mapa.values()].filter((g) => g.itens.length > 0)
    if (semBu.itens.length) grupos.push(semBu)
    return grupos
  })()

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Mapping</h1>
          <p>Quantas empresas já subiram o template deste ciclo/versão, e em que ponto cada uma está</p>
        </div>
      </header>

      <div className="content">
        <div className="panel">
          <div className="panel-header">
            <BotaoRecolher chave="mapping-1" />
            <div>
              <h2>Ciclo e versão</h2>
              <p>O mapa reflete a versão escolhida aqui</p>
            </div>
          </div>
          <div className="panel-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FiltroBotoes
                label="Ciclo"
                valor={selectedAno ?? ''}
                opcoes={ciclos.map((c) => ({ valor: c.ano, rotulo: String(c.ano) }))}
                onChange={(v) => {
                  setSelectedAno(Number(v))
                  setSelectedVersaoId('')
                }}
                semTodas
                semCorte
              />
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
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <BotaoRecolher chave="mapping-2" />
            <div>
              <h2>Resumo</h2>
              <p>{linhas.length} empresa(s) cadastrada(s)</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="mapping-legenda">
              {Object.entries(CORES_MAPPING).map(([cor, info]) => (
                <div key={cor} className="mapping-legenda-item">
                  <span className={`mapping-quadrado mapping-quadrado-mini ${info.classe}`} />
                  <span>
                    {info.rotulo} <strong>({contagem[cor] ?? 0})</strong>
                  </span>
                </div>
              ))}
            </div>

            {loading ? (
              <div className="empty-hint">Carregando…</div>
            ) : linhas.length === 0 ? (
              <div className="empty-hint">Nenhuma empresa cadastrada ainda.</div>
            ) : (
              porBu.map(({ bu, itens }) => (
                <div key={bu.id ?? 'sem-bu'} className="mapping-bu-secao">
                  <h3 className="mapping-bu-titulo">
                    {bu.nome} <span className="mapping-bu-contagem">({itens.length})</span>
                  </h3>
                  <div className="mapping-grid">
                    {itens.map(({ empresa, cor }) => (
                      <div key={empresa.id} className={`mapping-quadrado ${CORES_MAPPING[cor].classe}`} title={empresa.nome}>
                        <span className="mapping-quadrado-label">{empresa.nome}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
