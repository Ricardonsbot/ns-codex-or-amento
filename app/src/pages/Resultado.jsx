import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import PainelResultado from '../components/PainelResultado'
import FiltroBotoes from '../components/FiltroBotoes'
import { useToast } from '../components/ToastProvider'
import { fetchVersaoAtual } from '../lib/lancamentosData'
import { fetchBUs, fetchTorres, fetchEmpresas } from '../lib/dashboardData'
import {
  fetchResultado,
  fetchVersoesDoCiclo,
  anual,
  percentual,
  variacao,
  achatar,
  semaforo,
} from '../lib/resultadoData'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const brl = (v) =>
  Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const milhoes = (v) => `${(Number(v ?? 0) / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
const pct = (v) => (v === null || !isFinite(v) ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
/** Percentual curto, do jeito do painel: uma casa e o sinal quando positivo. */
const pct2 = (v) =>
  v === null || !isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

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

const COR_SEMAFORO = { verde: '#1a7f47', amarelo: '#d99a00', vermelho: '#c0392b' }

/** O ponto colorido do painel: acima do comparativo, perto, ou longe. */
function Ponto({ pct }) {
  const cor = COR_SEMAFORO[semaforo(pct)]
  if (!cor) return <span style={{ opacity: 0.25 }}>·</span>
  return <span style={{ color: cor, fontSize: 15 }} aria-hidden="true">●</span>
}

/** Um bloco de medida do painel: Actual, %NR, Budget, Δ, Δ% e o ponto. */
function Medida({ atual, budget, base, comparando, menorEMelhor, comNR }) {
  const { delta, pct } = variacao(atual, budget ?? 0)
  const bom = menorEMelhor ? delta < 0 : delta > 0
  const cor = delta === 0 ? 'inherit' : bom ? COR_SEMAFORO.verde : COR_SEMAFORO.vermelho
  return (
    <>
      <td className="text-right">{milhoes(atual)}</td>
      {/* %NR e participacao, nao variacao: vai sem sinal de mais. */}
      {comNR && <td className="text-right" style={{ opacity: 0.75 }}>{pct(percentual(atual, base))}</td>}
      {comparando && (
        <>
          <td className="text-right" style={{ opacity: 0.75 }}>{milhoes(budget)}</td>
          <td className="text-right" style={{ color: cor }}>
            {delta > 0 ? '+' : ''}
            {milhoes(delta)}
          </td>
          <td className="text-right" style={{ color: cor }}>{pct2(pct)}</td>
          <td className="text-center"><Ponto pct={menorEMelhor && pct !== null ? -pct : pct} /></td>
        </>
      )}
    </>
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
  const [empresas, setEmpresas] = useState([])
  const [buId, setBuId] = useState('')
  const [torreId, setTorreId] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [dados, setDados] = useState(null)
  const [versoes, setVersoes] = useState([])
  const [compararCom, setCompararCom] = useState('')
  const [comp, setComp] = useState(null)
  const [mensal, setMensal] = useState('ano')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const [va, b, t, e] = await Promise.all([
          fetchVersaoAtual(), fetchBUs(), fetchTorres(), fetchEmpresas(),
        ])
        setVersao(va)
        setBus(b)
        setTorres(t)
        setEmpresas(e)
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
        const filtros = { buId: buId || null, torreId: torreId || null, empresaId: empresaId || null }
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
  }, [versao, buId, torreId, empresaId, compararCom])

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
  const empresasDisponiveis = torreId
    ? empresas.filter((e) => e.torre_id === torreId)
    : buId
    ? empresas.filter((e) => e.bu_id === buId)
    : empresas
  const recorte = empresaId
    ? empresas.find((e) => e.id === empresaId)?.nome
    : torreId
    ? torres.find((t) => t.id === torreId)?.nome
    : buId
    ? bus.find((b) => b.id === buId)?.nome
    : 'Consolidado'

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Resultado</h1>
          <p>
            Ciclo {versao.ciclo.ano} · {versao.versao.nome} · <strong>{recorte}</strong>
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
          {/* P&L por empresa: o mesmo demonstrativo, so daquela empresa. */}
          <FiltroBotoes
            label="Empresa"
            valor={empresaId}
            rotuloTodas="Consolidado"
            opcoes={empresasDisponiveis.map((e) => ({ valor: e.id, rotulo: e.nome }))}
            onChange={setEmpresaId}
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

            <PainelResultado
              arvore={dados.arvore}
              consolidado={{
                receita: base,
                ebitdaAposCapex: anual(dados.subtotais.ebitdaAposCapex),
              }}
              comparacao={
                comp
                  ? {
                      estrutura: comp.estrutura,
                      consolidado: {
                        receita: anual(comp.subtotais.receitaLiquida),
                        ebitdaAposCapex: anual(comp.subtotais.ebitdaAposCapex),
                      },
                    }
                  : null
              }
              subtitulo={`[ BRL M ] · Consolidado → BU → Torre → Sub Torre → Empresa${
                comp ? ` · comparando com ${versoes.find((v) => v.id === compararCom)?.nome ?? 'budget'}` : ''
              }`}
            />

            {/* MODULO: resultado de cada empresa, so as tres medidas que se olha
                primeiro — quanto fatura, quanto sobra e quanto sobra depois do capex. */}
            {dados.empresas?.length > 0 && (
              <div className="panel" style={{ marginBottom: 18 }}>
                <div className="panel-header">
                  <div>
                    <h2>Resultados por empresa</h2>
                    <p>Net Revenue, EBITDA e EBITDA after Capex de cada empresa, com a margem sobre a própria receita</p>
                  </div>
                </div>
                <div className="panel-body">
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table painel-resultado">
                      <thead>
                        <tr>
                          <th />
                          <th className="text-center" colSpan={1}>NET REVENUE</th>
                          <th className="text-center" colSpan={2}>EBITDA</th>
                          <th className="text-center" colSpan={2}>EBITDA AFTER CAPEX</th>
                        </tr>
                        <tr>
                          <th>EMPRESA</th>
                          <th className="text-right">ANO</th>
                          <th className="text-right">ANO</th>
                          <th className="text-right">MARGEM</th>
                          <th className="text-right">ANO</th>
                          <th className="text-right">MARGEM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dados.empresas.map((e) => {
                          const nr = anual(e.receitaLiquida)
                          const eb = anual(e.ebitda)
                          const ec = anual(e.ebitdaAposCapex)
                          return (
                            <tr key={e.id ?? e.nome}>
                              <td><strong>{e.nome}</strong></td>
                              <td className="text-right">{brl(nr)}</td>
                              <td className="text-right">{brl(eb)}</td>
                              <td className="text-right" style={{ opacity: 0.75 }}>{pct(percentual(eb, nr))}</td>
                              <td className="text-right">{brl(ec)}</td>
                              <td className="text-right" style={{ opacity: 0.75 }}>{pct(percentual(ec, nr))}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td><strong>Consolidado</strong></td>
                          <td className="text-right"><strong>{brl(base)}</strong></td>
                          <td className="text-right"><strong>{brl(anual(dados.subtotais.ebitda))}</strong></td>
                          <td className="text-right">{pct(percentual(anual(dados.subtotais.ebitda), base))}</td>
                          <td className="text-right"><strong>{brl(anual(dados.subtotais.ebitdaAposCapex))}</strong></td>
                          <td className="text-right">{pct(percentual(anual(dados.subtotais.ebitdaAposCapex), base))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* MODULO: o P&L aberto, uma coluna por empresa. E onde se ve QUAL
                linha de custo pesa em cada uma, que o quadro acima nao mostra. */}
            {dados.empresas?.length > 0 && (
              <div className="panel" style={{ marginBottom: 18 }}>
                <div className="panel-header">
                  <div>
                    <h2>P&amp;L por empresa</h2>
                    <p>As linhas do P&amp;L abertas por empresa — cada coluna é uma, a última é o consolidado</p>
                  </div>
                </div>
                <div className="panel-body">
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table painel-resultado">
                      <thead>
                        <tr>
                          <th style={{ position: 'sticky', left: 0, background: 'var(--color-surface)' }}>LINHA</th>
                          {dados.empresas.map((e) => (
                            <th key={e.id ?? e.nome} className="text-right">{e.nome.toUpperCase()}</th>
                          ))}
                          <th className="text-right">CONSOLIDADO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dados.pl.map((l) => {
                          const total = anual(l.valores)
                          if (!l.eSubtotal && total === 0) return null
                          const valorEmp = (e) => {
                            if (l.subtotal === 'receitaLiquida') return anual(e.receitaLiquida)
                            if (l.subtotal === 'ebitda') return anual(e.ebitda)
                            if (l.subtotal === 'ebitdaAposCapex') return anual(e.ebitdaAposCapex)
                            if (l.subtotal) return null
                            return anual(e.porLinha.get(l.chave) ?? [])
                          }
                          return (
                            <tr
                              key={l.rotulo}
                              style={
                                l.eSubtotal
                                  ? { background: 'var(--color-surface-alt, #f2f4f7)', fontWeight: 700 }
                                  : undefined
                              }
                            >
                              <td style={{ position: 'sticky', left: 0, background: 'inherit' }}>{l.rotulo}</td>
                              {dados.empresas.map((e) => {
                                const v = valorEmp(e)
                                return (
                                  <td
                                    key={e.id ?? e.nome}
                                    className="text-right"
                                    style={{ opacity: v === 0 || v === null ? 0.3 : 1 }}
                                  >
                                    {v === null ? '—' : v === 0 ? '—' : brl(v)}
                                  </td>
                                )
                              })}
                              <td className="text-right"><strong>{brl(total)}</strong></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                    Net Income não é aberto por empresa: as linhas abaixo do EBITDA — D&amp;A, financeiro,
                    IR/CSLL — não vêm com empresa em todos os lançamentos, e ratear aqui seria inventar.
                  </p>
                </div>
              </div>
            )}

            {/* Por area de alocacao: a segunda dimensao do P&L, que vem do
                template e nao do plano de contas. */}
            {dados.areas?.length > 0 && (
              <div className="panel" style={{ marginBottom: 18 }}>
                <div className="panel-header">
                  <div>
                    <h2>Por área de alocação</h2>
                    <p>
                      COGS, G&amp;A, S&amp;M, R&amp;D — vem da coluna “Alocação PnL (Área)” do template. Receita
                      não tem área: é Net Revenue.
                    </p>
                  </div>
                </div>
                <div className="panel-body">
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>ÁREA</th>
                          {mensal === 'mes' && MESES.map((m) => <th key={m} className="text-right">{m.toUpperCase()}</th>)}
                          <th className="text-right">ANO</th>
                          <th className="text-right">% NR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dados.areas.map((a) => (
                          <tr key={a.nome}>
                            <td><strong>{a.nome}</strong></td>
                            {mensal === 'mes' && a.valores.map((x, i) => (
                              <td key={i} className="text-right" style={{ fontSize: 12, opacity: x === 0 ? 0.3 : 1 }}>
                                {x === 0 ? '—' : brl(x)}
                              </td>
                            ))}
                            <td className="text-right">{brl(anual(a.valores))}</td>
                            <td className="text-right">{pct(percentual(anual(a.valores), base))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td><strong>Total de custos e despesas</strong></td>
                          {mensal === 'mes' && MESES.map((_, i) => (
                            <td key={i} className="text-right" style={{ fontSize: 12 }}>
                              <strong>{brl(dados.areas.reduce((t, a) => t + a.valores[i], 0))}</strong>
                            </td>
                          ))}
                          <td className="text-right">
                            <strong>{brl(dados.areas.reduce((t, a) => t + anual(a.valores), 0))}</strong>
                          </td>
                          <td className="text-right">
                            <strong>{pct(percentual(dados.areas.reduce((t, a) => t + anual(a.valores), 0), base))}</strong>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
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

          </>
        )}
      </div>
    </Layout>
  )
}
