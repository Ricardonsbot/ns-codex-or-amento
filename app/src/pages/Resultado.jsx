import { Fragment, useEffect, useState } from 'react'
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
  VISOES,
} from '../lib/resultadoData'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/**
 * As visões do Resultado, uma por aba.
 *
 * Antes vinham empilhadas numa rolagem só, e chegar no P&L custava passar por
 * quatro tabelas. Os filtros ficam acima das abas de propósito: o recorte —
 * BU, torre, empresa, comparativo — vale para todas, e trocar de aba não pode
 * perdê-lo nem voltar ao banco.
 */
const ABAS = [
  { valor: 'painel', rotulo: 'Painel Resultado' },
  { valor: 'empresas', rotulo: 'Resultados por empresa' },
  { valor: 'pl', rotulo: 'P&L' },
  { valor: 'plEmpresa', rotulo: 'P&L por empresa' },
  { valor: 'pacotes', rotulo: 'Gastos por pacote' },
  { valor: 'areas', rotulo: 'Por área' },
]

const brl = (v) =>
  Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const milhoes = (v) => `${(Number(v ?? 0) / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
/** R$ M com uma casa: o formato #,##0.0 que o Master Resultado usa nas tabelas. */
const mi = (v) =>
  (Number(v ?? 0) / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const pct = (v) =>
  v === null || !isFinite(v)
    ? '—'
    : `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

/**
 * Δ e Δ% contra o comparativo. Verde e vermelho seguem o SENTIDO do indicador,
 * não o sinal: gastar menos que o budget é bom, faturar menos é ruim.
 */
function Variacao({ atual, comparado, menorEMelhor }) {
  if (comparado === undefined || comparado === null) return null
  const { delta, pct } = variacao(atual, comparado)
  const bom = menorEMelhor ? delta < 0 : delta > 0
  const cor = delta === 0 ? '' : bom ? 'melhor' : 'pior'
  return (
    <span className={cor}>
      {delta > 0 ? '+' : ''}
      {brl(delta)}
      {pct !== null && ` (${pct > 0 ? '+' : ''}${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`}
    </span>
  )
}

/**
 * Um dos blocos de resposta: "qual minha receita?", "qual meu EBITDA?"
 *
 * O valor sai sem cor. Custo alto nao e desvio — e custo; pintar de vermelho
 * so porque a linha e de despesa gastava a cor no lugar errado, que foi o que
 * o FP&A apontou. Vermelho e verde ficam para o Delta contra o budget.
 */
function Bloco({ pergunta, valor, base, comparado, menorEMelhor }) {
  const p = percentual(valor, base)
  return (
    <div className="bloco-kpi">
      <div className="bloco-kpi-pergunta">{pergunta}</div>
      <div className="bloco-kpi-valor">R$ {milhoes(valor)}</div>
      <div className="bloco-kpi-nota">
        {p === null ? 'sem base de receita' : `${pct(p)} da receita líquida`}
      </div>
      {comparado !== undefined && comparado !== null && (
        <div className="bloco-kpi-nota">
          <Variacao atual={valor} comparado={comparado} menorEMelhor={menorEMelhor} /> vs budget
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
  // Quais empresas tem lancamento nesta versao. O cadastro tem 60 e so um
  // punhado aparece no resultado; listar as 60 em botao enchia a tela de
  // opcao vazia antes do primeiro numero.
  const [comDado, setComDado] = useState(null)
  const [mensal, setMensal] = useState('ano')
  // Qual abertura do P&L: linha contabil, area (COGS/G&A/S&M/R&D) ou pacote.
  const [visao, setVisao] = useState('conta')
  const [aba, setAba] = useState('painel')
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
        // So a carga sem recorte enxerga todas: com filtro aplicado a lista
        // encolhe para o proprio filtro e nao serviria para trocar de empresa.
        if (!buId && !torreId && !empresaId) {
          setComDado(new Set(a.empresas.map((e) => e.id).filter(Boolean)))
        }
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
        <div className="content folha">
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
  const noRecorte = torreId
    ? empresas.filter((e) => e.torre_id === torreId)
    : buId
    ? empresas.filter((e) => e.bu_id === buId)
    : empresas
  // Primeiro as que tem lancamento; o resto continua acessivel atras do "+ N".
  const comLancamento = comDado ? noRecorte.filter((e) => comDado.has(e.id)) : []
  const empresasDisponiveis = comDado
    ? [...comLancamento, ...noRecorte.filter((e) => !comDado.has(e.id))]
    : noRecorte
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

      <div className="content folha">
        {/* Mesmo formato do "Contexto do Lançamento" no módulo de Revenue:
            painel com cabeçalho e os chips no estilo padrão. Sem o painel, os
            filtros ficavam soltos no topo da folha e pareciam inacabados. */}
        <div className="panel recorte">
          <div className="panel-header">
            <div>
              <h2>Recorte</h2>
              <p>BU, Torre e Empresa — vale para todas as visões abaixo</p>
            </div>
          </div>
          <div className="panel-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
            limite={10}
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
            limite={comLancamento.length || 12}
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
          </div>
        </div>

        {carregando && <div className="empty-hint">Carregando…</div>}

        {!carregando && dados && (
          <>
            {/* As perguntas em bloco */}
            <div className="blocos-kpi">
              <Bloco
                pergunta="Qual minha receita?"
                valor={base}
                base={base}
                comparado={comp ? anual(comp.subtotais.receitaLiquida) : null}
              />
              <Bloco
                pergunta="Qual meu custo?"
                valor={custos}
                base={base}
                menorEMelhor
                comparado={comp ? anual(comp.subtotais.receitaLiquida) - anual(comp.subtotais.ebitda) : null}
              />
              <Bloco
                pergunta="Qual meu EBITDA?"
                valor={anual(dados.subtotais.ebitda)}
                base={base}
                comparado={comp ? anual(comp.subtotais.ebitda) : null}
              />
              <Bloco
                pergunta="Qual meu capex?"
                valor={anual(dados.capex)}
                base={base}
                menorEMelhor
                comparado={comp ? anual(comp.capex) : null}
              />
              <Bloco
                pergunta="EBITDA after Capex"
                valor={anual(dados.subtotais.ebitdaAposCapex)}
                base={base}
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
            </nav>

            {aba === 'painel' && (
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
              subtitulo={`Consolidado → BU → Torre → Sub Torre → Empresa${
                comp ? ` · comparando com ${versoes.find((v) => v.id === compararCom)?.nome ?? 'budget'}` : ''
              }`}
            />
            )}

            {/* MODULO: resultado de cada empresa, so as tres medidas que se olha
                primeiro — quanto fatura, quanto sobra e quanto sobra depois do capex. */}
            {aba === 'empresas' && dados.empresas?.length > 0 && (
              <div className="panel" style={{ marginBottom: 18 }}>
                <div className="panel-header">
                  <div>
                    <h2>Resultados por empresa</h2>
                    <p>Net Revenue, EBITDA e EBITDA after Capex de cada empresa, com a margem sobre a própria receita</p>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="rolagem-x">
                    <table className="tabela-xl sem-indice">
                      <thead>
                        <tr className="faixa">
                          <th className="canto fixa-2">[ BRL M ]</th>
                          <th className="vao" />
                          <th>Net Revenue</th>
                          <th className="vao" />
                          <th colSpan={2}>EBITDA</th>
                          <th className="vao" />
                          <th colSpan={2}>Adj. Ebitda After Capex</th>
                          <th className="vao" />
                          <th colSpan={2}>Net Income</th>
                        </tr>
                        <tr className="rotulos">
                          <th className="rotulo fixa-2">Empresa</th>
                          <th className="vao" />
                          <th className="atual">Actual</th>
                          <th className="vao" />
                          <th className="atual">Actual</th>
                          <th>%NR</th>
                          <th className="vao" />
                          <th className="atual">Actual</th>
                          <th>%NR</th>
                          <th className="vao" />
                          <th className="atual">Actual</th>
                          <th>%NR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dados.empresas.map((e) => {
                          const nr = anual(e.receitaLiquida)
                          const eb = anual(e.ebitda)
                          const ec = anual(e.ebitdaAposCapex)
                          const ni = anual(e.netIncome)
                          return (
                            <tr key={e.id ?? e.nome}>
                              <td className="rotulo fixa-2">{e.nome}</td>
                              <td className="vao" />
                              <td className="valor">{mi(nr)}</td>
                              <td className="vao" />
                              <td className="valor">{mi(eb)}</td>
                              <td>{pct(percentual(eb, nr))}</td>
                              <td className="vao" />
                              <td className="valor">{mi(ec)}</td>
                              <td>{pct(percentual(ec, nr))}</td>
                              <td className="vao" />
                              <td className="valor">{mi(ni)}</td>
                              <td>{pct(percentual(ni, nr))}</td>
                            </tr>
                          )
                        })}
                        <tr className="respiro">
                          <td colSpan={13} />
                        </tr>
                        <tr className="consolidado">
                          <td className="rotulo fixa-2">Consolidado</td>
                          <td className="vao" />
                          <td className="valor">{mi(base)}</td>
                          <td className="vao" />
                          <td className="valor">{mi(anual(dados.subtotais.ebitda))}</td>
                          <td>{pct(percentual(anual(dados.subtotais.ebitda), base))}</td>
                          <td className="vao" />
                          <td className="valor">{mi(anual(dados.subtotais.ebitdaAposCapex))}</td>
                          <td>{pct(percentual(anual(dados.subtotais.ebitdaAposCapex), base))}</td>
                          <td className="vao" />
                          <td className="valor">{mi(anual(dados.subtotais.netIncome))}</td>
                          <td>{pct(percentual(anual(dados.subtotais.netIncome), base))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* MODULO: o P&L aberto, uma coluna por empresa. E onde se ve QUAL
                linha de custo pesa em cada uma, que o quadro acima nao mostra. */}
            {aba === 'plEmpresa' && dados.empresas?.length > 0 && (
              <div className="panel" style={{ marginBottom: 18 }}>
                <div className="panel-header">
                  <div>
                    <h2>P&amp;L por empresa</h2>
                    <p>As linhas do P&amp;L abertas por empresa — cada coluna é uma, a última é o consolidado</p>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="rolagem-x">
                    <table className="tabela-xl sem-indice">
                      <thead>
                        <tr className="faixa">
                          <th className="canto fixa-2">[ BRL M ]</th>
                          <th className="vao" />
                          <th colSpan={dados.empresas.length}>Empresas</th>
                          <th className="vao" />
                          <th>Consolidado</th>
                        </tr>
                        <tr className="rotulos">
                          <th className="rotulo fixa-2">Linha do P&amp;L</th>
                          <th className="vao" />
                          {dados.empresas.map((e) => (
                            <th key={e.id ?? e.nome}>{e.nome}</th>
                          ))}
                          <th className="vao" />
                          <th className="atual">Actual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(dados.pls?.[visao] ?? dados.pl).map((l) => {
                          const total = anual(l.valores)
                          if (l.eSecao) {
                            return (
                              <tr key={l.rotulo} className="secao">
                                <td className="rotulo fixa-2">{l.rotulo}</td>
                                <td colSpan={99} />
                              </tr>
                            )
                          }
                          if (!l.eSubtotal && total === 0) return null
                          // Cada empresa carrega os mesmos subtotais do
                          // consolidado, calculados pela mesma função.
                          const valorEmp = (e) => {
                            if (l.subtotal) return e[l.subtotal] ? anual(e[l.subtotal]) : null
                            if (l.area) return anual(e.porArea?.get(l.area) ?? [])
                            return anual(e.porLinha.get(l.linha) ?? [])
                          }
                          const classe = l.eSubtotal ? 'faixa-soma' : 'detalhe'
                          return (
                            <tr key={l.rotulo} className={classe}>
                              <td className="rotulo fixa-2">
                                {l.eSubtotal ? `= ${l.rotulo}` : l.rotulo}
                              </td>
                              <td className="vao" />
                              {dados.empresas.map((e) => {
                                const v = valorEmp(e)
                                const vazio = v === null || v === 0
                                return (
                                  <td key={e.id ?? e.nome} className={vazio ? 'apagado' : undefined}>
                                    {vazio ? '—' : mi(v)}
                                  </td>
                                )
                              })}
                              <td className="vao" />
                              <td className="valor">{mi(total)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="nota-tabela">
                    Nada é rateado: cada linha soma os lançamentos daquela empresa. Uma célula com travessão é
                    empresa sem lançamento naquela linha, não valor escondido.
                  </p>
                </div>
              </div>
            )}

            {/* MODULO: o gasto aberto em pacote e subpacote, com o % sobre a
                receita liquida. E um quadro proprio, e nao uma visao do P&L:
                o que se olha aqui e a composicao do gasto, nao o caminho ate
                o EBITDA. */}
            {aba === 'pacotes' && dados.pacotes?.length > 0 && (
              <div className="panel" style={{ marginBottom: 18 }}>
                <div className="panel-header">
                  <div>
                    <h2>Gastos por pacote</h2>
                    <p>
                      Cada pacote aberto nos seus subpacotes, com o percentual sobre a receita líquida
                    </p>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="rolagem-x">
                    <table className="tabela-xl sem-indice">
                      <thead>
                        <tr className="faixa">
                          <th className="canto fixa-2">[ BRL M ]</th>
                          <th className="vao" />
                          <th colSpan={2}>Gastos</th>
                        </tr>
                        <tr className="rotulos">
                          <th className="rotulo fixa-2">Pacote</th>
                          <th className="vao" />
                          <th className="atual">Actual</th>
                          <th>% RoL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dados.pacotes.map((p, i) => {
                          const total = anual(p.valores)
                          return (
                            <Fragment key={p.nome}>
                              {i > 0 && (
                                <tr className="respiro">
                                  <td colSpan={4} />
                                </tr>
                              )}
                              <tr className="pai">
                                <td className="rotulo fixa-2">{p.nome}</td>
                                <td className="vao" />
                                <td className="valor">{mi(total)}</td>
                                <td>{pct(percentual(total, base))}</td>
                              </tr>
                              {p.subpacotes.map((sub) => {
                                const v = anual(sub.valores)
                                return (
                                  <tr key={sub.nome} className="subpacote">
                                    <td className="rotulo fixa-2">{sub.nome}</td>
                                    <td className="vao" />
                                    <td className="valor">{mi(v)}</td>
                                    <td>{pct(percentual(v, base))}</td>
                                  </tr>
                                )
                              })}
                            </Fragment>
                          )
                        })}
                        <tr className="respiro">
                          <td colSpan={4} />
                        </tr>
                        {(() => {
                          const t = dados.pacotes.reduce((a, p) => a + anual(p.valores), 0)
                          return (
                            <tr className="faixa-soma">
                              <td className="rotulo fixa-2">= Total de gastos</td>
                              <td className="vao" />
                              <td className="valor">{mi(t)}</td>
                              <td>{pct(percentual(t, base))}</td>
                            </tr>
                          )
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <p className="nota-tabela">
                    O pacote vem da coluna “Pacote” do template, não do plano de contas. Por isso este total
                    inclui os lançamentos cuja conta ainda não está cadastrada, que o P&amp;L deixa de fora — a
                    diferença entre os dois é exatamente esse valor.
                  </p>
                </div>
              </div>
            )}

            {/* Por area de alocacao: a segunda dimensao do P&L, que vem do
                template e nao do plano de contas. */}
            {aba === 'areas' && dados.areas?.length > 0 && (
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
                  <div className="rolagem-x">
                    <table className="tabela-xl sem-indice">
                      <thead>
                        <tr className="faixa">
                          <th className="canto fixa-2">[ BRL M ]</th>
                          {mensal === 'mes' && <th className="vao" />}
                          {mensal === 'mes' && <th colSpan={12}>Mês a mês</th>}
                          <th className="vao" />
                          <th colSpan={2}>Ano</th>
                        </tr>
                        <tr className="rotulos">
                          <th className="rotulo fixa-2">Área</th>
                          {mensal === 'mes' && <th className="vao" />}
                          {mensal === 'mes' && MESES.map((m) => <th key={m}>{m}</th>)}
                          <th className="vao" />
                          <th className="atual">Actual</th>
                          <th>%NR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dados.areas.map((a) => (
                          <tr key={a.nome} className="detalhe">
                            <td className="rotulo fixa-2">{a.nome}</td>
                            {mensal === 'mes' && <td className="vao" />}
                            {mensal === 'mes' && a.valores.map((x, i) => (
                              <td key={i} className={x === 0 ? 'apagado' : undefined}>
                                {x === 0 ? '—' : mi(x)}
                              </td>
                            ))}
                            <td className="vao" />
                            <td className="valor">{mi(anual(a.valores))}</td>
                            <td>{pct(percentual(anual(a.valores), base))}</td>
                          </tr>
                        ))}
                        <tr className="faixa-soma">
                          <td className="rotulo fixa-2">= Total de custos e despesas</td>
                          {mensal === 'mes' && <td className="vao" />}
                          {mensal === 'mes' && MESES.map((_, i) => (
                            <td key={i}>{mi(dados.areas.reduce((t, a) => t + a.valores[i], 0))}</td>
                          ))}
                          <td className="vao" />
                          <td className="valor">{mi(dados.areas.reduce((t, a) => t + anual(a.valores), 0))}</td>
                          <td>{pct(percentual(dados.areas.reduce((t, a) => t + anual(a.valores), 0), base))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* O P&L linha a linha */}
            {aba === 'pl' && (
            <div className="panel" style={{ marginBottom: 18 }}>
              <div className="panel-header">
                <div>
                  <h2>P&amp;L</h2>
                  <p>
                    Na ordem do Master Resultado, de Gross Revenue a Adjusted EBITDA After Capex.
                    {' '}As três visões abrem o mesmo bloco de despesa de jeitos diferentes e somam o mesmo total.
                  </p>
                </div>
                <FiltroBotoes
                  label="Visão"
                  valor={visao}
                  opcoes={(dados.pls ? VISOES.filter((v) => dados.pls[v.valor]) : VISOES).map((v) => ({
                    valor: v.valor,
                    rotulo: v.rotulo,
                  }))}
                  onChange={setVisao}
                  semTodas
                />
              </div>
              <div className="panel-body">
                <div className="rolagem-x">
                  <table className="tabela-xl sem-indice">
                    <thead>
                      <tr className="faixa">
                        <th className="canto fixa-2">[ BRL M ]</th>
                        {mensal === 'mes' && <th className="vao" />}
                        {mensal === 'mes' && <th colSpan={12}>Mês a mês</th>}
                        <th className="vao" />
                        <th colSpan={2}>Ano</th>
                        {comp && <th className="vao" />}
                        {comp && <th colSpan={3}>Budget</th>}
                      </tr>
                      <tr className="rotulos">
                        <th className="rotulo fixa-2">Linha do P&amp;L</th>
                        {mensal === 'mes' && <th className="vao" />}
                        {mensal === 'mes' && MESES.map((m) => <th key={m}>{m}</th>)}
                        <th className="vao" />
                        <th className="atual">Actual</th>
                        <th>%NR</th>
                        {comp && (
                          <>
                            <th className="vao" />
                            <th className="orcado">Budget</th>
                            <th>Δ</th>
                            <th>Δ%</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(dados.pls?.[visao] ?? dados.pl).map((l) => {
                        const v = anual(l.valores)
                        // Cabeçalho de seção não tem valor; linha zerada que não
                        // é subtotal só ocupa espaço.
                        if (l.eSecao) {
                          return (
                            <tr key={l.rotulo} className="secao">
                              <td className="rotulo fixa-2">{l.rotulo}</td>
                              <td colSpan={99} />
                            </tr>
                          )
                        }
                        // O esqueleto sai inteiro, mesmo zerado: e assim que o
                        // Master mostra, e uma linha ausente e ambigua — nao da
                        // para saber se e zero ou se a ferramenta nao tem.
                        const classe = l.eSubtotal ? 'faixa-soma' : 'detalhe'
                        return (
                          <tr key={l.rotulo} className={classe}>
                            <td className="rotulo fixa-2">{l.eSubtotal ? `= ${l.rotulo}` : l.rotulo}</td>
                            {mensal === 'mes' && <td className="vao" />}
                            {mensal === 'mes' &&
                              l.valores.map((x, i) => (
                                <td key={i} className={x === 0 ? 'apagado' : undefined}>
                                  {x === 0 ? '—' : mi(x)}
                                </td>
                              ))}
                            <td className="vao" />
                            <td className={v === 0 ? 'valor apagado' : 'valor'}>{v === 0 ? '—' : mi(v)}</td>
                            <td className={v === 0 ? 'apagado' : undefined}>
                              {v === 0 ? '—' : pct(percentual(v, base))}
                            </td>
                            {comp && (() => {
                              const alvo = (comp.pls?.[visao] ?? comp.pl).find((x) => x.rotulo === l.rotulo)
                              const b = anual(alvo?.valores)
                              const { delta, pct: dp } = variacao(v, b)
                              return (
                                <>
                                  <td className="vao" />
                                  <td className="valor">{mi(b)}</td>
                                  <td>
                                    {delta > 0 ? '+' : ''}{mi(delta)}
                                  </td>
                                  <td>
                                    {dp === null
                                      ? '—'
                                      : `${dp > 0 ? '+' : ''}${dp.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
                                  </td>
                                </>
                              )
                            })()}
                          </tr>
                        )
                      })}
                      {dados.fora.map((f) => (
                        <tr key={f.chave} className="alerta">
                          <td className="rotulo fixa-2">
                            {f.chave} · fora da estrutura do P&amp;L
                          </td>
                          {mensal === 'mes' && <td className="vao" />}
                          {mensal === 'mes' && f.valores.map((x, i) => (
                            <td key={i} className={x === 0 ? 'apagado' : undefined}>
                              {x === 0 ? '—' : mi(x)}
                            </td>
                          ))}
                          <td className="vao" />
                          <td className="valor">{mi(anual(f.valores))}</td>
                          <td>{pct(percentual(anual(f.valores), base))}</td>
                          {comp && (
                            <>
                              <td className="vao" />
                              <td className="valor apagado">—</td>
                              <td className="apagado">—</td>
                              <td className="apagado">—</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            )}

          </>
        )}
      </div>
    </Layout>
  )
}
