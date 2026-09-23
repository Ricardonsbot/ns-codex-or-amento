import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import FiltroBotoes from '../components/FiltroBotoes'
import SeletorColunas from '../components/SeletorColunas'
import TabelaQuadro from '../components/TabelaQuadro'
import { exportarExcel } from '../lib/excelUtils'
import { useToast } from '../components/ToastProvider'
import { fetchVersaoAtual } from '../lib/lancamentosData'
import { fetchBUs, fetchTorres, fetchEmpresas } from '../lib/dashboardData'
import { fetchResultado, fetchCiclosResultado, versaoReferencia } from '../lib/resultadoData'
import { MESES, MEDIDAS_MOM, janela } from '../lib/demonstrativo'
import { ABAS, montarQuadro, quadroParaExportar, bigNumbers } from '../lib/quadrosResultado'
import Indicadores from '../components/Indicadores'
import BotaoUnidade from '../components/BotaoUnidade'
import SeletorEmpresa from '../components/SeletorEmpresa'
import BridgeOrcamento from '../components/BridgeOrcamento'
import MenuExportar from '../components/MenuExportar'
import { montarExportacaoEmpilhada } from '../lib/exportarResultado'
import { fetchLancamentosParaExportar } from '../lib/lancamentosData'
import { useUnidade } from '../components/UnidadeProvider'

const umaCasa = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const brl = (v) => Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Performance Overview em barras: Actual, Budget e Last Year por medida. */
function Performance({ quadro }) {
  const { numero } = useUnidade()
  const papeis = [
    ['a', 'Actual', 'atual'],
    ['b', 'Budget', 'orcado'],
    ['l', 'Last Year', 'ly'],
  ]
  return (
    <div className="performance">
      {quadro.linhas.map((l) => (
        <div key={l.rotulo} className="performance-card">
          <h3>{l.rotulo}</h3>
          {quadro.grupos.map((g, gi) => {
            const per = gi === 0 ? 'MTD' : 'YTD'
            const vals = papeis.map(([k]) => l.v[`${per}.${k}`]).filter((x) => x !== undefined && x !== null)
            const max = Math.max(1e-9, ...vals.map((x) => Math.abs(x)))
            return (
              <div key={g.rotulo}>
                <div className="performance-periodo">{g.rotulo}</div>
                {papeis.map(([k, nome, classe]) => {
                  const x = l.v[`${per}.${k}`]
                  if (x === undefined) return null
                  const largura = x === null ? 0 : (Math.abs(x) / max) * 100
                  return (
                    <div key={k} className="performance-barra">
                      <span>{nome}</span>
                      <div className="performance-trilho">
                        <span className={`${classe}${x < 0 ? ' negativo' : ''}`} style={{ width: `${largura}%` }} />
                      </div>
                      <span className="performance-valor">
                        {x === null ? '—' : l.fmt === 'pct' ? `${umaCasa(x)}%` : numero(x)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/**
 * Resultado: o orçamento no formato da Master Resultado, aba por aba e na
 * mesma ordem das abas da Master.
 *
 * Três versões entram em cada quadro: a do ano escolhido (Actual), a versão
 * de "Comparar com" (Budget) e o budget do ano anterior (Last Year), que é
 * achado sozinho pelo ciclo `ano − 1`. O mês de referência faz o MTD e o YTD;
 * com dezembro, o YTD é o ano todo.
 */
export default function Resultado() {
  const showToast = useToast()
  const [ciclos, setCiclos] = useState([])
  const [cicloId, setCicloId] = useState('')
  const [bus, setBus] = useState([])
  const [torres, setTorres] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [buId, setBuId] = useState('')
  const [torreId, setTorreId] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [compararCom, setCompararCom] = useState('')
  const [mes, setMes] = useState(12)
  const [dados, setDados] = useState(null)
  const [comp, setComp] = useState(null)
  const [ly, setLy] = useState(null)
  // Quais empresas têm lançamento no ano: vão primeiro nos botões.
  const [comDado, setComDado] = useState(null)
  const [aba, setAba] = useState('mom')
  const [medida, setMedida] = useState('nr')
  const [areaPacote, setAreaPacote] = useState('')
  const [dimensaoBridge, setDimensaoBridge] = useState('driver')
  const [modoEmpresa, setModoEmpresa] = useState('mes')
  const [empresaPl, setEmpresaPl] = useState('')
  const [exportacao, setExportacao] = useState(null)
  const [preparando, setPreparando] = useState(false)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const [cs, va, b, t, e] = await Promise.all([
          fetchCiclosResultado(),
          fetchVersaoAtual(),
          fetchBUs(),
          fetchTorres(),
          fetchEmpresas(),
        ])
        setCiclos(cs)
        setCicloId(va?.ciclo?.id ?? cs[0]?.id ?? '')
        setBus(b)
        setTorres(t)
        setEmpresas(e)
      } catch (err) {
        showToast(`Erro ao carregar: ${err.message}`, 'error')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ciclo = ciclos.find((c) => c.id === cicloId) ?? null
  const versao = versaoReferencia(ciclo)
  const cicloLy = ciclo ? ciclos.find((c) => c.ano === ciclo.ano - 1) : null
  const versaoLy = versaoReferencia(cicloLy)
  const outrasVersoes = (ciclo?.versao ?? []).filter((v) => v.id !== versao?.id)

  useEffect(() => {
    if (!versao) return
    ;(async () => {
      setCarregando(true)
      try {
        const filtros = { buId: buId || null, torreId: torreId || null, empresaId: empresaId || null }
        const [a, b, l] = await Promise.all([
          fetchResultado(versao.id, filtros),
          compararCom ? fetchResultado(compararCom, filtros) : Promise.resolve(null),
          versaoLy ? fetchResultado(versaoLy.id, filtros) : Promise.resolve(null),
        ])
        setDados(a)
        setComp(b)
        setLy(l)
        if (!buId && !torreId && !empresaId) {
          setComDado(new Set(a.empresas.filter((e) => e.temLancamento).map((e) => e.id).filter(Boolean)))
        }
      } catch (err) {
        showToast(`Erro ao montar o resultado: ${err.message}`, 'error')
      } finally {
        setCarregando(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao?.id, versaoLy?.id, buId, torreId, empresaId, compararCom])

  const ctx = useMemo(
    () =>
      dados && {
        dados,
        comp,
        ly,
        mes,
        medida,
        areaPacote,
        dimensaoBridge,
        modoEmpresa,
        empresaPl,
        rotuloVersao: versao ? `${ciclo?.ano} · ${versao.nome}` : 'Actual',
        rotuloComp: comp ? outrasVersoes.find((v) => v.id === compararCom)?.nome : null,
        rotuloLy: versaoLy ? `LY ${cicloLy.ano}` : null,
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dados, comp, ly, mes, medida, areaPacote, dimensaoBridge, modoEmpresa, empresaPl]
  )
  /**
   * Base empilhada: os lançamentos gravados da versão, no mesmo recorte da
   * tela. Não sai do quadro — o quadro já vem somado — e por isso busca os
   * três tipos no banco.
   */
  async function exportarEmpilhada() {
    setPreparando(true)
    try {
      const filtros = { versaoId: versao.id, buId: buId || null, torreId: torreId || null, empresaId: empresaId || null }
      const porTipo = await Promise.all(
        ['receita', 'despesa', 'capex'].map((tipo) => fetchLancamentosParaExportar({ ...filtros, tipo }))
      )
      const lancamentos = porTipo.flat()
      if (!lancamentos.length) {
        showToast('Nenhum lançamento gravado nesse recorte para exportar.', 'warning')
        return
      }
      setExportacao(
        montarExportacaoEmpilhada(lancamentos, {
          bus,
          torres,
          empresas,
          recorte,
          rotuloVersao: versao.nome,
          ano: ciclo.ano,
        })
      )
    } catch (err) {
      showToast(`Erro ao preparar a exportação: ${err.message}`, 'error')
    } finally {
      setPreparando(false)
    }
  }

  const quadro = useMemo(() => {
    if (!ctx) return null
    try {
      return montarQuadro(aba, ctx)
    } catch (err) {
      return { erro: err.message }
    }
  }, [ctx, aba])

  if (!ciclos.length || !versao) {
    return (
      <Layout>
        <header className="topbar">
          <div className="topbar-title"><h1>Resultado</h1></div>
        </header>
        <div className="content folha">
          <div className="empty-hint">
            {ciclos.length ? 'Carregando…' : 'Nenhum ciclo cadastrado. Crie um em Budget - Settings.'}
          </div>
        </div>
      </Layout>
    )
  }

  const torresDaBu = buId ? torres.filter((t) => t.bu_id === buId) : torres
  const noRecorte = torreId
    ? empresas.filter((e) => e.torre_id === torreId)
    : buId
    ? empresas.filter((e) => e.bu_id === buId)
    : empresas
  const comLancamento = comDado ? noRecorte.filter((e) => comDado.has(e.id)) : []
  const empresasDisponiveis = comDado ? [...comLancamento, ...noRecorte.filter((e) => !comDado.has(e.id))] : noRecorte
  const recorte = empresaId
    ? empresas.find((e) => e.id === empresaId)?.nome
    : torreId
    ? torres.find((t) => t.id === torreId)?.nome
    : buId
    ? bus.find((b) => b.id === buId)?.nome
    : 'Consolidado'
  const semConta = dados ? janela(dados.semConta, 'FY') : 0
  const semDeducao = dados && dados.demo.ded.every((x) => !x) && dados.demo.gr.some((x) => x)
  const abaAtual = ABAS.find((a) => a.valor === aba)

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Resultado</h1>
          <p>
            Ciclo {ciclo.ano} · {versao.nome} · <strong>{recorte}</strong> · referência {MESES[mes - 1]}/{ciclo.ano}
            {dados ? ` · ${dados.lancamentos} lançamento(s)` : ''}
          </p>
        </div>
      </header>

      <div className="content folha">
        <div className="panel recorte">
          <div className="panel-header">
            <div>
              <h2>Recorte</h2>
              <p>Ano, mês de referência, BU, Torre, Empresa e unidade — vale para todas as visões abaixo</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="recorte-grupos">
              <div className="recorte-bu-torre">
                <FiltroBotoes
                  label="Ano (ciclo)"
                  valor={cicloId}
                  opcoes={ciclos.map((c) => ({ valor: c.id, rotulo: String(c.ano) }))}
                  onChange={(v) => {
                    setCicloId(v)
                    setCompararCom('')
                  }}
                  semTodas
                />
                <FiltroBotoes
                  label="Mês de referência (MTD / YTD)"
                  valor={String(mes)}
                  opcoes={MESES.map((m, i) => ({ valor: String(i + 1), rotulo: m }))}
                  onChange={(v) => setMes(Number(v))}
                  semTodas
                  semCorte
                />
              </div>
              <div className="recorte-bu-torre">
                <FiltroBotoes
                  label="BU"
                  valor={buId}
                  rotuloTodas="Consolidado"
                  opcoes={bus.map((b) => ({ valor: b.id, rotulo: b.nome }))}
                  onChange={(v) => {
                    setBuId(v)
                    setTorreId('')
                    setEmpresaId('')
                  }}
                />
                <FiltroBotoes
                  label="Torre"
                  valor={torreId}
                  rotuloTodas="Todas as Torres"
                  opcoes={torresDaBu.map((t) => ({ valor: t.id, rotulo: t.nome }))}
                  onChange={(v) => {
                    setTorreId(v)
                    setEmpresaId('')
                  }}
                />
              </div>
              <SeletorEmpresa
                empresas={empresasDisponiveis}
                torres={torres}
                valor={empresaId}
                onChange={setEmpresaId}
                rotuloTodas="Consolidado"
              />
              <BotaoUnidade />
              <div className="recorte-dupla">
                {outrasVersoes.length > 0 ? (
                  <FiltroBotoes
                    label="Comparar com (Budget)"
                    valor={compararCom}
                    rotuloTodas="Sem comparação"
                    opcoes={outrasVersoes.map((v) => ({ valor: v.id, rotulo: `${v.nome} (${v.tipo})` }))}
                    onChange={setCompararCom}
                  />
                ) : (
                  <div className="filtro-botoes">
                    <span className="filtro-botoes-label">Comparar com (Budget)</span>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>
                      O ciclo {ciclo.ano} só tem a versão “{versao.nome}”. Crie uma revisão em Budget - Settings.
                    </span>
                  </div>
                )}
                <div className="filtro-botoes">
                  <span className="filtro-botoes-label">Last Year</span>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>
                    {versaoLy
                      ? `Budget ${cicloLy.ano} · ${versaoLy.nome} — entra sozinho em todos os quadros`
                      : `Sem budget de ${ciclo.ano - 1}. Crie o ciclo ${ciclo.ano - 1} em Budget - Settings e importe o template daquele ano para aparecer o Last Year.`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {carregando && <div className="empty-hint">Carregando…</div>}

        {!carregando && dados && ctx && (
          <>
            <Indicadores itens={bigNumbers(ctx)} />

            <BridgeOrcamento
              receita={janela(dados.demo.nr, 'YTD', mes)}
              despesa={janela(dados.demo.nr, 'YTD', mes) - janela(dados.demo.adjEbitda, 'YTD', mes)}
              capex={-janela(dados.demo.capex, 'YTD', mes)}
              subtitulo={`${recorte} · ${ciclo.ano} ${versao.nome} · YTD ${MESES[mes - 1]}`}
            />

            {semConta !== 0 && (
              <div className="proto-banner" style={{ marginBottom: 18 }}>
                ⚠ R$ {brl(semConta)} em lançamentos <strong>sem conta</strong> não entram em nenhuma linha do P&amp;L.
                Resolva em Fluxo → Pendência de Cadastros.
              </div>
            )}
            {semDeducao && (
              <div className="proto-banner" style={{ marginBottom: 18 }}>
                ⓘ Não há dedução lançada, então a Net Revenue está igual à Gross Revenue. A ferramenta não calcula
                dedução: ela precisa ser lançada nas contas de “Receita &gt; (-) Deductions”.
              </div>
            )}

            <nav className="abas" aria-label="Visões do resultado">
              {ABAS.map((a) => (
                <button
                  key={a.valor}
                  type="button"
                  className={`aba${aba === a.valor ? ' ativa' : ''}`}
                  aria-current={aba === a.valor ? 'page' : undefined}
                  onClick={() => setAba(a.valor)}
                >
                  {a.rotulo}
                </button>
              ))}
              <div className="abas-exportar">
                <MenuExportar
                  desabilitado={!quadro || quadro.erro}
                  ocupado={preparando}
                  opcoes={[
                    { valor: 'quadro', rotulo: 'Quadro da tela', descricao: `${abaAtual?.rotulo}, como está aqui` },
                    {
                      valor: 'empilhada',
                      rotulo: 'Base empilhada',
                      descricao: 'Um lançamento por mês em cada linha, para tabela dinâmica e Power BI',
                    },
                  ]}
                  onEscolher={(f) =>
                    f === 'quadro' ? setExportacao(quadroParaExportar(quadro, { aba, recorte })) : exportarEmpilhada()
                  }
                />
              </div>
            </nav>

            <div className="panel" style={{ marginBottom: 18 }}>
              <div className="panel-header">
                <div>
                  <h2>{abaAtual.rotulo}</h2>
                  <p>
                    {abaAtual.foraDaMaster ? 'Quadro da ferramenta, sem equivalente na Master' : 'Mesmo layout da aba da Master Resultado'}
                    {' · '}Actual = {ciclo.ano} {versao.nome}
                    {comp ? ` · Budget = ${ctx.rotuloComp}` : ''}
                    {ly ? ` · Last Year = ${cicloLy.ano} ${versaoLy.nome}` : ''}
                  </p>
                </div>
                {aba === 'mom' && (
                  <FiltroBotoes
                    label="Medida"
                    valor={medida}
                    opcoes={MEDIDAS_MOM.map((m) => ({ valor: m.valor, rotulo: m.rotulo }))}
                    onChange={setMedida}
                    semTodas
                  />
                )}
                {aba === 'bridge' && (
                  <FiltroBotoes
                    label="Abrir por"
                    valor={dimensaoBridge}
                    opcoes={[
                      { valor: 'driver', rotulo: 'Driver' },
                      { valor: 'produto', rotulo: 'Produto' },
                      { valor: 'empresa', rotulo: 'Empresa' },
                      { valor: 'torre', rotulo: 'Torre' },
                    ]}
                    onChange={setDimensaoBridge}
                    semTodas
                  />
                )}
                {aba === 'pacotes' && (
                  <FiltroBotoes
                    label="Área"
                    valor={areaPacote}
                    rotuloTodas="Todas as áreas"
                    opcoes={(dados?.areasDosPacotes ?? []).map((a) => ({ valor: a, rotulo: a }))}
                    onChange={setAreaPacote}
                  />
                )}
                {aba === 'plEmpresa' && (
                  <FiltroBotoes
                    label="Formato"
                    valor={modoEmpresa}
                    opcoes={[
                      { valor: 'mes', rotulo: 'Uma empresa, mês a mês' },
                      { valor: 'lado', rotulo: 'Empresas lado a lado' },
                    ]}
                    onChange={setModoEmpresa}
                    semTodas
                  />
                )}
              </div>
              <div className="panel-body">
                {aba === 'plEmpresa' && modoEmpresa === 'mes' && (
                  <div style={{ marginBottom: 12 }}>
                    <FiltroBotoes
                      label="Empresa do P&L"
                      valor={empresaPl}
                      rotuloTodas="Consolidado"
                      opcoes={(dados.empresas ?? []).filter((e) => e.id).map((e) => ({ valor: e.id, rotulo: e.nome }))}
                      onChange={setEmpresaPl}
                    />
                  </div>
                )}
                {quadro?.erro && <div className="empty-hint">Não consegui montar este quadro: {quadro.erro}</div>}
                {quadro && !quadro.erro && (quadro.grafico ? <Performance quadro={quadro} /> : <TabelaQuadro quadro={quadro} />)}
                {quadro?.notas?.map((n) => (
                  <p key={n} className="nota-tabela">
                    {n}
                  </p>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {exportacao && (
        <SeletorColunas
          nomeArquivo={exportacao.nomeArquivo}
          chavePreferencia={exportacao.chavePreferencia}
          colunas={exportacao.colunas}
          onCancelar={() => setExportacao(null)}
          onConfirmar={(escolhidas) => {
            exportarExcel(exportacao.nomeArquivo, exportacao.linhas, escolhidas)
            setExportacao(null)
          }}
        />
      )}
    </Layout>
  )
}
