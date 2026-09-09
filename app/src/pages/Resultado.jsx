import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import FiltroBotoes from '../components/FiltroBotoes'
import { useToast } from '../components/ToastProvider'
import { fetchVersaoAtual } from '../lib/lancamentosData'
import { fetchBUs, fetchTorres } from '../lib/dashboardData'
import { fetchResultado, fetchVersoesDoCiclo, anual, percentual, variacao } from '../lib/resultadoData'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const brl = (v) =>
  Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const milhoes = (v) => `${(Number(v ?? 0) / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
const pct = (v) => (v === null || !isFinite(v) ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)

/**
 * Δ e Δ% contra o comparativo. Verde e vermelho seguem o SENTIDO do indicador,
 * não o sinal: gastar menos que o budget é bom, faturar menos é ruim.
 */
function Variacao({ atual, comparado, menorEMelhor }) {
  if (comparado === undefined || comparado === null) return null
  const { delta, pct } = variacao(atual, comparado)
  const bom = menorEMelhor ? delta < 0 : delta > 0
  const cor = delta === 0 ? 'inherit' : bom ? 'var(--color-success, #1a7f47)' : 'var(--color-danger, #c0392b)'
  return (
    <span style={{ color: cor }}>
      {delta > 0 ? '+' : ''}
      {brl(delta)}
      {pct !== null && ` (${pct > 0 ? '+' : ''}${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`}
    </span>
  )
}

/** Um dos blocos de resposta: "qual minha receita?", "qual meu EBITDA?" */
function Bloco({ pergunta, valor, base, destaque, negativo, comparado, menorEMelhor }) {
  const p = percentual(valor, base)
  return (
    <div
      style={{
        flex: '1 1 190px',
        padding: '14px 16px',
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${destaque}`,
        background: 'var(--color-surface)',
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{pergunta}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: negativo && valor > 0 ? 'var(--color-danger, #c0392b)' : 'inherit' }}>
        R$ {milhoes(valor)}
      </div>
      <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
        {p === null ? 'sem base de receita' : `${pct(p)} da receita líquida`}
      </div>
      {comparado !== undefined && comparado !== null && (
        <div style={{ fontSize: 12, marginTop: 4 }}>
          <Variacao atual={valor} comparado={comparado} menorEMelhor={menorEMelhor} />
          <span style={{ opacity: 0.55 }}> vs budget</span>
        </div>
      )}
    </div>
  )
}

/**
 * Resultado: o que os lançamentos viraram, no formato do P&L Contábil.
 *
 * Responde em blocos as perguntas que se faz depois de subir os dados — qual a
 * receita, o custo, o EBITDA, o capex e quanto isso representa —, abre o P&L
 * linha a linha e depois pela estrutura BU → Torre → Sub Torre → Empresa.
 */
export default function Resultado() {
  const showToast = useToast()
  const [versao, setVersao] = useState(null)
  const [bus, setBus] = useState([])
  const [torres, setTorres] = useState([])
  const [buId, setBuId] = useState('')
  const [torreId, setTorreId] = useState('')
  const [dados, setDados] = useState(null)
  const [versoes, setVersoes] = useState([])
  const [compararCom, setCompararCom] = useState('')
  const [comp, setComp] = useState(null)
  const [mensal, setMensal] = useState('ano')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const [va, b, t] = await Promise.all([fetchVersaoAtual(), fetchBUs(), fetchTorres()])
        setVersao(va)
        setBus(b)
        setTorres(t)
        if (va?.ciclo) {
          const vs = await fetchVersoesDoCiclo(va.ciclo.id)
          setVersoes(vs.filter((x) => x.id !== va.versao?.id))
        }
      } catch (err) {
        showToast(`Erro ao carregar: ${err.message}`, 'error')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!versao?.versao) return
    ;(async () => {
      setCarregando(true)
      try {
        const filtros = { buId: buId || null, torreId: torreId || null }
        const [a, b] = await Promise.all([
          fetchResultado(versao.versao.id, filtros),
          compararCom ? fetchResultado(compararCom, filtros) : Promise.resolve(null),
        ])
        setDados(a)
        setComp(b)
      } catch (err) {
        showToast(`Erro ao montar o resultado: ${err.message}`, 'error')
      } finally {
        setCarregando(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao, buId, torreId, compararCom])

  if (!versao?.versao) {
    return (
      <Layout>
        <header className="topbar">
          <div className="topbar-title"><h1>Resultado</h1></div>
        </header>
        <div className="content">
          <div className="empty-hint">
            Nenhum ciclo com versão ativa. Crie um em Budget - Settings.
          </div>
        </div>
      </Layout>
    )
  }

  const base = dados ? anual(dados.subtotais.receitaLiquida) : 0
  const custos = dados ? base - anual(dados.subtotais.ebitda) : 0
  const torresDaBu = buId ? torres.filter((t) => t.bu_id === buId) : torres

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Resultado</h1>
          <p>
            Ciclo {versao.ciclo.ano} · {versao.versao.nome}
            {dados ? ` · ${dados.lancamentos} lançamento(s)` : ''}
          </p>
        </div>
      </header>

      <div className="content">
        <div className="filter-bar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
          <FiltroBotoes
            label="BU"
            valor={buId}
            rotuloTodas="Consolidado"
            opcoes={bus.map((b) => ({ valor: b.id, rotulo: b.nome }))}
            onChange={(v) => {
              setBuId(v)
              setTorreId('')
            }}
          />
          <FiltroBotoes
            label="Torre"
            valor={torreId}
            rotuloTodas="Todas as Torres"
            opcoes={torresDaBu.map((t) => ({ valor: t.id, rotulo: t.nome }))}
            onChange={setTorreId}
          />
          <FiltroBotoes
            label="Visão"
            valor={mensal}
            opcoes={[{ valor: 'ano', rotulo: 'Ano' }, { valor: 'mes', rotulo: 'Mês a mês' }]}
            onChange={setMensal}
            semTodas
          />
          {versoes.length > 0 ? (
            <FiltroBotoes
              label="Comparar com (Budget)"
              valor={compararCom}
              rotuloTodas="Sem comparação"
              opcoes={versoes.map((v) => ({ valor: v.id, rotulo: `${v.nome} (${v.tipo})` }))}
              onChange={setCompararCom}
            />
          ) : (
            <div className="filtro-botoes">
              <span className="filtro-botoes-label">Comparar com (Budget)</span>
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                O ciclo {versao.ciclo.ano} só tem a versão “{versao.versao.nome}”. Crie uma revisão em
                Budget - Settings para comparar Δ e Δ%.
              </span>
            </div>
          )}
        </div>

        {carregando && <div className="empty-hint">Carregando…</div>}

        {!carregando && dados && (
          <>
            {/* As perguntas em bloco */}
            <div className="flex-row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
              <Bloco
                pergunta="Qual minha receita?"
                valor={base}
                base={base}
                destaque="#1a7f47"
                comparado={comp ? anual(comp.subtotais.receitaLiquida) : null}
              />
              <Bloco
                pergunta="Qual meu custo?"
                valor={custos}
                base={base}
                destaque="#c0392b"
                negativo
                menorEMelhor
                comparado={comp ? anual(comp.subtotais.receitaLiquida) - anual(comp.subtotais.ebitda) : null}
              />
              <Bloco
                pergunta="Qual meu EBITDA?"
                valor={anual(dados.subtotais.ebitda)}
                base={base}
                destaque="#ff3d03"
                comparado={comp ? anual(comp.subtotais.ebitda) : null}
              />
              <Bloco
                pergunta="Qual meu capex?"
                valor={anual(dados.capex)}
                base={base}
                destaque="#8a94a6"
                negativo
                menorEMelhor
                comparado={comp ? anual(comp.capex) : null}
              />
              <Bloco
                pergunta="EBITDA after Capex"
                valor={anual(dados.subtotais.ebitdaAposCapex)}
                base={base}
                destaque="#20242d"
                comparado={comp ? anual(comp.subtotais.ebitdaAposCapex) : null}
              />
            </div>

            {anual(dados.semConta) !== 0 && (
              <div className="proto-banner" style={{ marginBottom: 18 }}>
                ⚠ R$ {brl(anual(dados.semConta))} em lançamentos <strong>sem conta</strong> não entram em nenhuma
                linha do P&amp;L. Resolva em Fluxo → Pendência de Cadastros.
              </div>
            )}

            {anual(dados.deducoes) === 0 && anual(dados.receitaBruta) !== 0 && (
              <div className="proto-banner" style={{ marginBottom: 18 }}>
                ⓘ Não há dedução lançada, então a Receita Líquida está igual à Bruta e os percentuais usam essa
                base. A ferramenta não calcula dedução: ela precisa ser lançada nas contas de
                “Receita &gt; (-) Deductions”.
              </div>
            )}

            {/* O P&L linha a linha */}
            <div className="panel" style={{ marginBottom: 18 }}>
              <div className="panel-header">
                <div>
                  <h2>P&amp;L Contábil</h2>
                  <p>Cada linha vem do plano de contas; o percentual é sobre a receita líquida</p>
                </div>
              </div>
              <div className="panel-body">
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>LINHA</th>
                        {mensal === 'mes' && MESES.map((m) => <th key={m} className="text-right">{m.toUpperCase()}</th>)}
                        <th className="text-right">ANO</th>
                        <th className="text-right">% NR</th>
                        {comp && (
                          <>
                            <th className="text-right">BUDGET</th>
                            <th className="text-right">Δ</th>
                            <th className="text-right">Δ%</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {dados.pl.map((l) => {
                        const v = anual(l.valores)
                        if (!l.eSubtotal && v === 0) return null
                        return (
                          <tr
                            key={l.rotulo}
                            style={
                              l.eSubtotal
                                ? { background: 'var(--color-surface-alt, #f2f4f7)', fontWeight: 700 }
                                : undefined
                            }
                          >
                            <td>{l.rotulo}</td>
                            {mensal === 'mes' &&
                              l.valores.map((x, i) => (
                                <td key={i} className="text-right" style={{ fontSize: 12, opacity: x === 0 ? 0.3 : 1 }}>
                                  {x === 0 ? '—' : brl(x)}
                                </td>
                              ))}
                            <td className="text-right">{brl(v)}</td>
                            <td className="text-right">{pct(percentual(v, base))}</td>
                            {comp && (() => {
                              const alvo = comp.pl.find((x) => x.rotulo === l.rotulo)
                              const b = anual(alvo?.valores)
                              const { delta, pct: dp } = variacao(v, b)
                              // Linha de despesa: gastar menos que o budget é bom.
                              const menor = l.sinal === -1
                              const bom = menor ? delta < 0 : delta > 0
                              const cor =
                                delta === 0
                                  ? 'inherit'
                                  : bom
                                  ? 'var(--color-success, #1a7f47)'
                                  : 'var(--color-danger, #c0392b)'
                              return (
                                <>
                                  <td className="text-right">{brl(b)}</td>
                                  <td className="text-right" style={{ color: cor }}>
                                    {delta > 0 ? '+' : ''}{brl(delta)}
                                  </td>
                                  <td className="text-right" style={{ color: cor }}>
                                    {dp === null ? '—' : `${dp > 0 ? '+' : ''}${dp.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
                                  </td>
                                </>
                              )
                            })()}
                          </tr>
                        )
                      })}
                      {dados.fora.map((f) => (
                        <tr key={f.chave} style={{ background: 'var(--color-surface-alt, #fff6f4)' }}>
                          <td>{f.chave} <span style={{ opacity: 0.6, fontSize: 12 }}>· fora da estrutura do P&amp;L</span></td>
                          {mensal === 'mes' && f.valores.map((x, i) => (
                            <td key={i} className="text-right" style={{ fontSize: 12 }}>{x === 0 ? '—' : brl(x)}</td>
                          ))}
                          <td className="text-right">{brl(anual(f.valores))}</td>
                          <td className="text-right">{pct(percentual(anual(f.valores), base))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* A mesma coisa pela estrutura */}
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>Por estrutura</h2>
                  <p>BU → Torre → Sub Torre → Empresa</p>
                </div>
              </div>
              <div className="panel-body">
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ESTRUTURA</th>
                        <th className="text-right">RECEITA</th>
                        <th className="text-right">DESPESA</th>
                        <th className="text-right">EBITDA</th>
                        <th className="text-right">MARGEM</th>
                        <th className="text-right">CAPEX</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.estrutura.map((no, i) => {
                        const r = anual(no.receita)
                        const d = anual(no.despesa)
                        const e = r - d
                        return (
                          <tr key={i} style={no.nivel === 0 ? { fontWeight: 700 } : undefined}>
                            <td style={{ paddingLeft: 12 + no.nivel * 18 }}>{no.nome}</td>
                            <td className="text-right">{brl(r)}</td>
                            <td className="text-right">{brl(d)}</td>
                            <td className="text-right">{brl(e)}</td>
                            <td className="text-right">{pct(percentual(e, r))}</td>
                            <td className="text-right">{brl(anual(no.capex))}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
