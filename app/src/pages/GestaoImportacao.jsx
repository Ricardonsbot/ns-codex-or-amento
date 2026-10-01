import { Fragment, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { Etapa, statusAba } from '../components/ImportWizard'
import ProgressoGravacao from '../components/ProgressoGravacao'
import ChecklistImportacao from '../components/ChecklistImportacao'
import AlertaStatus from '../components/AlertaStatus'
import TutorialImportacao from '../components/TutorialImportacao'
import HistoricoImportacoes from '../components/HistoricoImportacoes'
import TemplatesRecusados from '../components/TemplatesRecusados'
import CardTargetsPacote from '../components/CardTargetsPacote'
import { useToast } from '../components/ToastProvider'
import { useAuth } from '../components/AuthProvider'
import { agruparParaCadastro, solicitar, tabelaDisponivel } from '../lib/contasPendentesData'
import { createCiclo } from '../lib/ciclosData'
import { agruparPorPacoteDivergente, resumoDaConta, SITUACOES } from '../lib/conferenciaPorConta'
import { resumoDoUpload } from '../lib/resumoDoUpload'
import { avaliar, resumoDoArquivo } from '../lib/importacoesData'
import Indicadores from '../components/Indicadores'
import { useSubTela } from '../lib/identificadorTela'
import {
  lerTodosOsTiposEmWorker,
  conferir,
  importar,
  desfazer,
} from '../lib/importarTemplateOrcamento'
import {
  registrarImportacao,
  registrarTentativaRecusada,
  registrarRecusaDeConferencia,
  marcarDesfeito,
  resumoDaImportacao,
  amarrarLancamentos,
} from '../lib/importacoesData'
import BotaoRecolher from '../components/BotaoRecolher'

const ROTULO = { receita: 'Revenue', despesa: 'Expenses', capex: 'Capex' }
const NOME = { receita: 'receita', despesa: 'despesa', capex: 'capex' }
// O nome da aba na planilha é "Base Gastos" — é por ele que a leitura se
// orienta, e não muda. Aqui é só o texto mostrado na tela.
const ABA_EXIBICAO = { 'Base Gastos': 'Base de Gastos' }
const ORDEM = ['receita', 'despesa', 'capex']

const brl = (v) => `R$ ${Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Um ciclo por ano, mesmo com os três cards conferindo ao mesmo tempo.
 *
 * O ciclo do ano do arquivo é encanamento, não pergunta: se não existe, a
 * conferência cria e segue. Como os três cards conferem em paralelo, os três
 * pediriam a criação do mesmo ano ao mesmo tempo — a promessa fica guardada
 * por ano e os outros dois esperam a primeira.
 */
const criacoesDeCiclo = new Map()
function garantirCiclo(ano) {
  if (!criacoesDeCiclo.has(ano)) criacoesDeCiclo.set(ano, createCiclo(ano))
  return criacoesDeCiclo.get(ano)
}

/**
 * Igual ao `semCadastro` de ImportarTemplateOrcamento: só vai para aprovação
 * quem tem dado de verdade e não é só uma conta com classificação diferente.
 */
const semCadastro = (m) =>
  Boolean((m.contaCodigo || m.contaRotulo || '').trim()) &&
  !(m.falhas ?? []).some((f) => f.includes('está no plano como'))

/**
 * Uma conferência por tipo, lado a lado na mesma tela. É a mesma lógica de
 * confirmar/desfazer da importação de cada módulo de lançamento — só que
 * aqui os três correm a partir de UM upload já lido, em vez de três telas
 * com um "Importar Template" cada uma.
 */
function CardTipo({
  ref,
  tipo,
  lido,
  arquivo,
  nomeTemplate,
  podeSolicitar,
  onPrevia,
  onImportado,
  onRegistrar,
  onDesfeito,
  // Capex grava como tipo próprio (ver EAC, relatórios), mas a conferência
  // é visual: some o título daqui e os pacotes dele continuam direto
  // embaixo dos de Despesa, na mesma árvore — sem botão de confirmar
  // próprio, sem seção própria.
  tituloOculto,
  // Só em Despesa, quando Capex também tem dado: acrescenta "+ Capex" no
  // título, pra avisar que os pacotes dele estão ali dentro.
  tipoMesclado,
}) {
  const showToast = useToast()
  const { sessao } = useAuth()
  const email = sessao?.user?.email
  const [previa, setPrevia] = useState(null)
  const [conferindo, setConferindo] = useState(true)
  const [erroConferencia, setErroConferencia] = useState(null)
  const [gravando, setGravando] = useState(false)
  const [progresso, setProgresso] = useState(null)
  const [ultima, setUltima] = useState(null)
  const [desfazendo, setDesfazendo] = useState(false)
  const [checklistAberto, setChecklistAberto] = useState(false)
  // Quais subpacotes estão abertos na conferência, mostrando as linhas embaixo.
  const [abertos, setAbertos] = useState(() => new Set())
  // Quais pacotes estão abertos, mostrando os subpacotes embaixo — o primeiro
  // vem aberto por padrão, os demais fecham sozinhos, pra não começar com
  // tudo exposto de uma vez num arquivo com vários pacotes.
  const [pacotesAbertos, setPacotesAbertos] = useState(() => new Set())

  useEffect(() => {
    let cancelado = false
    async function rodar() {
      setConferindo(true)
      setErroConferencia(null)
      try {
        let p = { ...(await conferir(lido)), ano: lido.ano, ignoradas: lido.ignoradas }
        // Sem o ciclo do ano não há versão onde gravar. Cria e confere de
        // novo, em vez de parar a pessoa com um botão no meio do caminho.
        if (p.cicloFaltando) {
          await garantirCiclo(p.cicloFaltando)
          p = { ...(await conferir(lido)), ano: lido.ano, ignoradas: lido.ignoradas }
        }
        if (cancelado) return
        setPrevia(p)
        // A tela junta as prévias dos três módulos no sumário de ofensas: o
        // arquivo é um só, e a ofensa é do arquivo.
        onPrevia?.(tipo, p)
      } catch (err) {
        if (!cancelado) setErroConferencia(err.message)
      } finally {
        if (!cancelado) setConferindo(false)
      }
    }
    rodar()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lido])

  async function handleConfirmar() {
    // A versão já tinha lançamentos deste tipo: entra como pendência no
    // checklist, não impede — substituir deixou de ser uma escolha daqui.
    const somouEmCima = Boolean(previa.jaExistem)
    setGravando(true)
    setProgresso({ feitos: 0, total: 0, fase: 'cabecalhos' })
    try {
      const ids = await importar([...previa.prontas, ...previa.marcadas], previa.versao.id, tipo, (feitos, total, fase) =>
        setProgresso({ feitos, total, fase })
      )
      const oQue = NOME[tipo]

      let enviadas = 0
      let erroEnvio = null
      const paraEnviar = previa.marcadas.filter(semCadastro)
      if (paraEnviar.length && podeSolicitar) {
        try {
          enviadas = await solicitar(agruparParaCadastro(paraEnviar, tipo, arquivo), email)
        } catch (err) {
          erroEnvio = err.message
        }
      }

      showToast(
        `${ids.length} lançamento(s) de ${oQue} importado(s).` +
          (enviadas ? ` ${enviadas} conta(s) enviada(s) para aprovação de cadastro.` : ''),
        erroEnvio ? 'warning' : 'success'
      )
      if (erroEnvio) showToast(`As linhas entraram, mas não consegui enviar as contas para aprovação: ${erroEnvio}`, 'error')

      // O histórico vem depois de gravar e num try próprio: falhar aqui não
      // desfaz nem invalida a importação, que já está no banco.
      try {
        await onRegistrar?.(tipo, {
          ids,
          linhas: [...previa.prontas, ...previa.marcadas],
          apagados: 0,
          fora: previa.fora.length,
          textoEmNumero: previa.fora.filter((f) => f.naoNumericos?.length).length,
          marcadas: previa.marcadas.length,
          somouEmCima,
          cadastros: previa.cadastros,
          ano: lido.ano,
          ciclo: previa.ciclo,
          versao: previa.versao,
          nomeTemplate,
        })
      } catch (err) {
        showToast(`Importado, mas não consegui registrar no histórico: ${err.message}`, 'warning')
      }

      setUltima({
        ids,
        quantos: ids.length,
        enviadas,
        // Abre a janela do checklist assim que a gravação termina.
        resumo: resumoDaImportacao({
          ano: lido.ano,
          versao: previa.versao,
          tipo,
          linhas: [...previa.prontas, ...previa.marcadas],
          fora: previa.fora.length,
          textoEmNumero: previa.fora.filter((f) => f.naoNumericos?.length).length,
          marcadas: previa.marcadas.length,
          apagados: 0,
          somouEmCima,
          cadastros: previa.cadastros,
          arquivo,
          usuarioEmail: email,
        }),
      })
      setChecklistAberto(true)
      setPrevia(null)
      onImportado?.()
    } catch (err) {
      showToast(`Erro ao importar ${NOME[tipo]}: ${err.message}`, 'error')
    } finally {
      setGravando(false)
      setProgresso(null)
    }
  }

  async function handleDesfazer() {
    setDesfazendo(true)
    try {
      const n = await desfazer(ultima.ids)
      showToast(`${n} lançamento(s) de ${NOME[tipo]} desfeito(s).`, 'success')
      try {
        await onDesfeito?.(tipo)
      } catch {
        // o desfazer já apagou os lançamentos; o histórico só fica sem a marca
      }
      setUltima(null)
      onImportado?.()
    } catch (err) {
      showToast(`Não consegui desfazer: ${err.message}`, 'error')
    } finally {
      setDesfazendo(false)
    }
  }

  const aImportar = previa ? [...previa.prontas, ...previa.marcadas] : []
  // As duas recusas são de natureza diferente e o aviso precisa dizer qual é:
  // texto numa coluna de valor não é empresa fora do cadastro.
  const semVersao = previa && !previa.versao
  // A conferência por Pacote > Subpacote, só quem tem algo a resolver: a
  // regra mora em conferenciaPorConta.js, testada à parte.
  const porPacote = useMemo(() => agruparPorPacoteDivergente(previa), [previa])
  const subpacotesComOfensa = porPacote.reduce((a, p) => a + p.subpacotes.length, 0)

  // Drill down: o primeiro pacote vem aberto, os demais fecham sozinhos —
  // quando chega uma conferência nova (arquivo novo ou reconferência pelo
  // ciclo faltando), o padrão volta a valer em vez de herdar o que a pessoa
  // tinha aberto na vez anterior.
  useEffect(() => {
    setPacotesAbertos(porPacote.length ? new Set([porPacote[0].pacote]) : new Set())
    setAbertos(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previa])


  // O "Importar o template inteiro" da tela chama isto em cada card, um
  // depois do outro. Cada módulo continua com a conferência e a gravação que
  // já tinha; o que muda é quem aperta o botão.
  useImperativeHandle(
    ref,
    () => ({
      pronto: Boolean(previa && aImportar.length && !semVersao && !gravando),
      confirmar: handleConfirmar,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previa, aImportar.length, semVersao, gravando]
  )

  return (
    <section className="modulo-conferencia">
      {/* Seção, não painel: o template é uma coisa só. Não há o que escolher
          nem o que deixar de fora — as três abas entram juntas ou nenhuma
          entra, e meio arquivo no banco não é um estado que alguém queira. */}
      {!tituloOculto && (
        <div className="modulo-conferencia-topo">
          <BotaoRecolher chave={`conferencia-${tipo}`} rotulo={ROTULO[tipo]} />
          <h3>
            {ROTULO[tipo]} - Aba: {ABA_EXIBICAO[lido.aba] ?? lido.aba}
            {tipoMesclado && ` + ${ROTULO[tipoMesclado]}`}
            {subpacotesComOfensa > 0 && (
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>
                Pendências
              </span>
            )}
          </h3>
          {gravando && <span>importando…</span>}
          {previa?.jaExistem > 0 && (
            <span style={{ marginLeft: 'auto' }}>
              ⚠ {previa.jaExistem} lançamento(s) identificados como duplicadas.
            </span>
          )}
        </div>
      )}

      <div>
        {gravando && <ProgressoGravacao progresso={progresso} rotulo={ROTULO[tipo]} />}

        {lido.erro && (
          <div className="proto-banner">✕ Não consegui ler esta aba: {lido.erro}</div>
        )}

        {!lido.erro && !lido.linhas.length && (
          <div className="empty-hint">Nenhuma linha com valor mensal preenchido nesta aba.</div>
        )}

        {conferindo && <div className="empty-hint">Conferindo com o plano de contas e a estrutura…</div>}

        {erroConferencia && <div className="proto-banner">✕ Erro ao conferir: {erroConferencia}</div>}

        {ultima?.resumo && (
          <AlertaStatus registro={ultima.resumo} escopo="tipo" onAbrir={() => setChecklistAberto(true)} />
        )}

        {ultima && (
          <div
            className="flex-row"
            style={{ gap: 12, alignItems: 'center', padding: '9px 12px', borderRadius: 6, background: 'var(--color-surface-alt, #f2f4f7)', border: '1px solid var(--color-border, #e2e5ea)' }}
          >
            <span style={{ fontSize: 13 }}>
              {ultima.quantos} lançamento(s) de {NOME[tipo]} importado(s) agora.
              {ultima.enviadas > 0 && (
                <>
                  {' '}{ultima.enviadas} conta(s) enviada(s) para aprovação — acompanhe em{' '}
                  <Link to="/pendencia-cadastros">Pendência de Cadastros</Link>.
                </>
              )}
            </span>
            {ultima.ids && (
              <button className="btn btn-secondary btn-sm" type="button" onClick={handleDesfazer} disabled={desfazendo}>
                {desfazendo ? 'Desfazendo…' : '↶ Desfazer'}
              </button>
            )}
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setUltima(null)} style={{ marginLeft: 'auto' }}>
              Dispensar
            </button>
          </div>
        )}

        {checklistAberto && ultima?.resumo && (
          <ChecklistImportacao
            registro={ultima.resumo}
            escopo="tipo"
            onFechar={() => setChecklistAberto(false)}
          />
        )}

        {previa && (
          <>
            {semVersao && (
              <div className="proto-banner" style={{ marginBottom: 12 }}>
                ⓘ O ciclo {previa.ano} não tem versão. Crie uma em Budget-Settings antes de importar.
              </div>
            )}

            {porPacote.length > 0 && (
              <>
                <strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                  {subpacotesComOfensa} subpacote(s) com pendência.
                </strong>

                <div className="tabela-pacote-scroll">
                  <table className="data-table tabela-contas">
                    <thead>
                      <tr>
                        <th>PACOTE / SUBPACOTE</th>
                        <th className="text-right">LINHAS</th>
                        <th className="text-right">TOTAL ANO</th>
                        <th>SITUAÇÃO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Só pacote e subpacote com ofensa chegam aqui — ver
                          agruparPorPacoteDivergente em conferenciaPorConta.js.
                          Drill down: pacote abre os subpacotes, subpacote abre
                          as linhas. O primeiro pacote já chega aberto. */}
                      {porPacote.map((pac) => {
                        const pacoteAberto = pacotesAbertos.has(pac.pacote)
                        return (
                          <Fragment key={pac.pacote}>
                            <tr
                              className="linha-pacote"
                              onClick={() =>
                                setPacotesAbertos((atual) => {
                                  const nova = new Set(atual)
                                  if (nova.has(pac.pacote)) nova.delete(pac.pacote)
                                  else nova.add(pac.pacote)
                                  return nova
                                })
                              }
                            >
                              <td colSpan={4}>
                                <span className="conta-seta" aria-hidden="true">{pacoteAberto ? '▾' : '▸'}</span>
                                <strong>{pac.pacote}</strong>
                                {tituloOculto && <span className="pill capex" style={{ marginLeft: 6 }}>Capex</span>}
                                <span style={{ opacity: 0.7, fontWeight: 400 }}>
                                  {' '}
                                  · {pac.subpacotes.length} subpacote(s) · {brl(pac.total)}
                                </span>
                              </td>
                            </tr>
                            {pacoteAberto &&
                              pac.subpacotes.map((s) => {
                                const chaveS = `${pac.pacote}::${s.subpacote}`
                                const aberta = abertos.has(chaveS)
                                return (
                                  <Fragment key={chaveS}>
                                    <tr
                                      className={`linha-conta conta-${s.pior}`}
                                      onClick={() =>
                                        setAbertos((atual) => {
                                          const nova = new Set(atual)
                                          if (nova.has(chaveS)) nova.delete(chaveS)
                                          else nova.add(chaveS)
                                          return nova
                                        })
                                      }
                                    >
                                      <td className="conta-filha">
                                        <span className="conta-seta" aria-hidden="true">{aberta ? '▾' : '▸'}</span>
                                        {s.subpacote}
                                      </td>
                                      <td className="text-right">{s.quantas}</td>
                                      <td className="text-right">{brl(s.total)}</td>
                                      <td style={{ fontSize: 12 }}>
                                        <span className={`conta-marca ${s.pior}`}>{SITUACOES[s.pior].marca}</span>{' '}
                                        {resumoDaConta(s)}
                                      </td>
                                    </tr>
                                    {aberta &&
                                      s.linhas.map((l) => (
                                        <tr key={`${chaveS}-${l.linha}`} className={`linha-da-conta ${l.situacao}`}>
                                          <td className="conta-neta">
                                            linha {l.linha} ·{' '}
                                            {(typeof l.empresa === 'object' ? l.empresa?.nome : l.empresa) || '—'} · conta{' '}
                                            {l.conta?.codigo || l.contaCodigo || '—'} {l.conta?.nome || l.contaRotulo || ''}
                                          </td>
                                          <td />
                                          <td className="text-right">{brl(l.total)}</td>
                                          <td style={{ fontSize: 12 }}>
                                            <span className={`conta-marca ${l.situacao}`}>{SITUACOES[l.situacao].marca}</span>{' '}
                                            {l.situacao === 'recusada' && `recusada — ${l.falhas.join(' · ')}`}
                                            {l.situacao === 'semConta' && `entra sem conta — ${l.falhas.join(' · ')}`}
                                            {l.situacao === 'apontada' &&
                                              `entra como está — ${l.avisos.join(' · ')} (${brl(-l.total)})`}
                                          </td>
                                        </tr>
                                      ))}
                                  </Fragment>
                                )
                              })}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}

/**
 * Gestão de Importação: sobe o Template Budget uma vez e cuida das três
 * abas de lançamento (Receita, Despesa, Capex) juntas, em vez de subir o
 * mesmo arquivo de novo em cada tela.
 *
 * Existe por dois motivos, os dois de desempenho: (1) quando o template não
 * tem aba própria de Capex, Despesa e Capex liam a mesma "Base Gastos" duas
 * vezes — aqui leem uma vez só (`lerTodosOsTiposEmWorker`); (2) quem
 * importava os três tipos abria o seletor de arquivo três vezes, e cada
 * leitura pesada partia do zero.
 */
export default function GestaoImportacao() {
  const showToast = useToast()
  const inputRef = useRef(null)
  const [arquivo, setArquivo] = useState('')
  // "Selecionar Template" não abre o seletor de arquivo do sistema na
  // hora — primeiro mostra esta tela, com o botão de escolher o arquivo
  // de verdade. Uma vez escolhido, a validação roda logo abaixo, na mesma
  // tela. Ciclo e versão não se escolhem aqui: a conferência usa sempre
  // a versão atual (ver `conferir`), e o nome do template é o do próprio
  // arquivo (`arquivo`, abaixo) — não há nome separado para digitar.
  const [telaSelecao, setTelaSelecao] = useState(false)
  // Enquanto esta tela está aberta por cima da rota, o ID que aparece não é
  // mais o da rota (GESTAO-IMPORTACAO) — é o da tela de verdade, a que
  // subiu para importar o arquivo.
  useSubTela(telaSelecao ? 'GESTAO-IMPORTACAO-IMPORTAR-TEMPLATE' : null)
  // O menu tem dois links pra esta mesma tela — "Importar - Template FP&A" e
  // "Importar - Pacote" — e é o `?modo=pacote` do segundo que já chega com o
  // interruptor ligado, sem a pessoa precisar marcar o checkbox na mão.
  const [searchParams] = useSearchParams()
  const modoPacote = searchParams.get('modo') === 'pacote'
  // O template é um só; o que muda é o papel de quem preencheu — e isso é a
  // tela por onde a pessoa entrou, não mais uma marcação manual: "Template
  // FP&A" sempre lança, "Template Pacote" sempre vira target.
  const comoTarget = modoPacote
  const [lendo, setLendo] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [estrutura, setEstrutura] = useState(null)
  const [erroLeitura, setErroLeitura] = useState(null)
  const [todos, setTodos] = useState(null)
  const [podeSolicitar, setPodeSolicitar] = useState(false)
  const [chave, setChave] = useState(0) // muda a cada upload, para os CardTipo remontarem do zero
  const [tamanho, setTamanho] = useState(null)
  const [versaoHistorico, setVersaoHistorico] = useState(0)
  const [tutorialAberto, setTutorialAberto] = useState(false)
  // Quantos tipos já foram gravados neste upload: leva o passo a passo ao fim.
  const [gravados, setGravados] = useState(0)
  // Qual módulo o "importar tudo" está gravando agora; null quando parado.
  const [importandoTudo, setImportandoTudo] = useState(null)
  // Qual módulo está aberto na conferência. Os três continuam montados — é
  // deles que sai o resumo do topo, e é neles que o "importar tudo" bate.
  // A prévia de cada módulo, reportada pelos cards: é o que alimenta o
  // sumário de ofensas do arquivo inteiro.
  const [previas, setPrevias] = useState({})
  const [checklistDoArquivo, setChecklistDoArquivo] = useState(false)
  const cards = useRef({})
  const { sessao } = useAuth()
  // Um registro de histórico por upload: o primeiro tipo importado cria, os
  // seguintes acrescentam. A fila impede dois cards de criarem dois registros
  // ao confirmar quase juntos.
  const registro = useRef({ id: null, fila: Promise.resolve() })

  useEffect(() => {
    tabelaDisponivel().then(setPodeSolicitar)
  }, [])

  useEffect(() => {
    if (!lendo) return undefined
    setSegundos(0)
    const t = setInterval(() => setSegundos((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [lendo])

  function handleArquivo(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) processarArquivo(file)
  }

  /** Arrastar solta no mesmo lugar que clicar em "Escolher arquivo" leva. */
  function handleSoltarArquivo(e) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) processarArquivo(file)
  }

  async function processarArquivo(file) {
    setArquivo(file.name)
    setTamanho(file.size)
    registro.current = { id: null, fila: Promise.resolve() }
    setGravados(0)
    setPrevias({})

    setLendo(true)
    setTodos(null)
    setEstrutura(null)
    setErroLeitura(null)
    try {
      const lidos = await lerTodosOsTiposEmWorker(await file.arrayBuffer(), setEstrutura)
      setTodos(lidos)
      setChave((c) => c + 1)
      // Arquivo lido, mas sem nada para trazer, é recusa igual: fica na lista
      // com o motivo, senão ninguém sabe que a pessoa tentou.
      const comDado = ORDEM.filter((t) => !lidos[t].erro && lidos[t].linhas.length > 0)
      if (!comDado.length) {
        const comErro = ORDEM.filter((t) => lidos[t].erro)
        registrarRecusa(
          comErro.length
            ? `Nenhuma aba pôde ser lida — ${comErro.map((t) => `${ROTULO[t]}: ${lidos[t].erro}`).join(' · ')}`
            : 'Nenhuma das três abas tinha linha com valor preenchido.',
          file.name,
          file.size
        )
      }
    } catch (err) {
      setErroLeitura(err.message)
      showToast(`Não consegui ler a planilha: ${err.message}`, 'error')
      registrarRecusa(`Não consegui ler a planilha — ${err.message}`, file.name, file.size)
    } finally {
      setLendo(false)
    }
  }

  /**
   * A tentativa que não virou importação entra na mesma lista, com quem
   * tentou e o motivo. Falhar aqui não pode virar um segundo erro na tela de
   * quem já está lidando com o primeiro.
   */
  async function registrarRecusa(motivo, nome, bytes) {
    try {
      const id = await registrarTentativaRecusada({
        arquivo: nome,
        tamanho: bytes,
        origem: 'gestao',
        usuarioEmail: sessao?.user?.email,
        motivo,
      })
      if (id) setVersaoHistorico((n) => n + 1)
    } catch {
      // O registro da recusa é acessório: o erro de verdade já foi mostrado.
    }
  }

  /** Grava os três módulos numa passada só, na ordem Receita → Despesa → Capex. */
  async function importarTudo() {
    for (const t of tiposComDado) {
      const card = cards.current[t]
      if (!card?.pronto) continue
      setImportandoTudo(t)
      try {
        await card.confirmar()
      } catch (err) {
        showToast(`Parei em ${ROTULO[t]}: ${err.message}`, 'error')
        break
      }
    }
    setImportandoTudo(null)
  }

  /**
   * Impedimento (campo essencial vazio, conta fora do plano...) não grava —
   * em vez de importar, registra a recusa com o mesmo resumo que uma
   * importação de verdade levaria, pra "Exibir detalhes" em Templates
   * Recusados poder reabrir a mesma janela de status.
   */
  async function recusarPorImpedimento(a) {
    const motivo = `Itens não preenchidos: ${a.impedimentos.map((i) => i.rotulo).join(', ')}`
    try {
      await registrarRecusaDeConferencia({
        arquivo,
        tamanho,
        origem: 'gestao',
        ano: registroDoArquivo.ano,
        ciclo: primeira?.ciclo,
        versao: primeira?.versao,
        usuarioEmail: sessao?.user?.email,
        motivo,
        tipos: registroDoArquivo.tipos,
        empresas: registroDoArquivo.empresas,
        totais: registroDoArquivo.totais,
      })
      showToast(`Arquivo recusado — ${motivo}.`, 'error')
      setVersaoHistorico((n) => n + 1)
      setTelaSelecao(false)
    } catch (err) {
      showToast(`Não consegui registrar a recusa: ${err.message}`, 'error')
    }
  }

  /**
   * O botão "Confirmar importação" só grava se o arquivo inteiro já foi
   * conferido e está liberado — com impedimento, vira recusa, não tentativa
   * de gravar. "Todas conferidas" importa: com a metade na mão, "falta
   * empresa" pode ser só a aba que ainda não chegou.
   */
  async function confirmarImportacao() {
    const todasConferidas = tiposComDado.length > 0 && tiposComDado.every((t) => previas[t])
    if (todasConferidas && registroDoArquivo) {
      const a = avaliar(registroDoArquivo)
      if (!a.liberado) {
        await recusarPorImpedimento(a)
        return
      }
    }
    await importarTudo()
  }

  function registrar(tipo, dados) {
    const r = registro.current
    const passo = r.fila.then(async () => {
      r.id = await registrarImportacao({
        ...dados,
        id: r.id,
        tipo,
        arquivo,
        tamanho,
        origem: 'gestao',
        usuarioEmail: sessao?.user?.email,
      })
      // Qual arquivo trouxe cada linha: é por aqui que o Deep Dive lista
      // templates de verdade em vez de agrupar por empresa.
      await amarrarLancamentos(r.id, dados.ids)
      setVersaoHistorico((n) => n + 1)
    })
    r.fila = passo.catch(() => {})
    return passo
  }

  async function desfeito(tipo) {
    const r = registro.current
    await r.fila
    await marcarDesfeito(r.id, tipo)
    setVersaoHistorico((n) => n + 1)
  }

  // 1 sem arquivo · 2 escolhendo · 3 lendo · 4 conferindo · 5 gravado
  const etapaTutorial = gravados ? 5 : todos ? 4 : lendo ? 3 : 1

  const tiposComDado = todos ? ORDEM.filter((t) => !todos[t].erro && todos[t].linhas.length > 0) : []
  const tiposVazios = todos ? ORDEM.filter((t) => !todos[t].erro && !todos[t].linhas.length) : []
  const tiposComErro = todos ? ORDEM.filter((t) => todos[t].erro) : []

  // O checklist é do arquivo, não de cada aba: o template entra inteiro, e é
  // inteiro que ele está apto ou não a consolidar.
  const primeira = tiposComDado.map((t) => previas[t]).find(Boolean)
  const registroDoArquivo = tiposComDado.some((t) => previas[t])
    ? resumoDoArquivo(
        tiposComDado
          .filter((t) => previas[t])
          .map((t) =>
            resumoDaImportacao({
              ano: todos[t].ano,
              versao: previas[t].versao,
              tipo: t,
              linhas: [...previas[t].prontas, ...previas[t].marcadas],
              fora: previas[t].fora.length,
              textoEmNumero: previas[t].fora.filter((f) => f.naoNumericos?.length).length,
              marcadas: previas[t].marcadas.length,
              apagados: 0,
              somouEmCima: Boolean(previas[t].jaExistem),
              cadastros: previas[t].cadastros,
              arquivo,
              usuarioEmail: sessao?.user?.email,
            })
          )
      )
    : null

  // O que o arquivo traz, somado: alimenta os big numbers e o gráfico.
  const resumo = resumoDoUpload(ORDEM.map((t) => ({ tipo: t, previa: previas[t] })))

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>{modoPacote ? 'Importar - Pacote' : 'Importar - Template FP&A'}</h1>
          <p>
            Suba o template uma vez — a ferramenta reconhece qual dos quatro é e confere o que aquele formato tem de
            trazer.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => setTutorialAberto(true)}>
          ? Como importar
        </button>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={() => setTelaSelecao(true)}
          disabled={lendo}
        >
          {lendo ? `Lendo planilha… ${segundos}s` : '⭱ Selecionar Template'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsb,.xlsx,.xlsm"
          style={{ display: 'none' }}
          onChange={handleArquivo}
        />
      </header>

      <div className="content">
        {!todos && !lendo && <TutorialImportacao etapa={etapaTutorial} />}

        {telaSelecao && (
          <div className="modal-overlay open" role="dialog" aria-modal="true" aria-label="Importar template">
            <div className="modal modal-importacao">
              <div className="modal-header">
                <h3>{todos ? arquivo : 'Importar template'}</h3>
                <div className="modal-header-acoes">
                  {todos && (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => inputRef.current?.click()}>
                      Trocar arquivo
                    </button>
                  )}
                  {todos && !comoTarget && tiposComDado.length > 0 && (
                    <button
                      className="btn btn-primary btn-sm"
                      type="button"
                      onClick={confirmarImportacao}
                      disabled={Boolean(importandoTudo)}
                    >
                      {importandoTudo ? `Importando ${ROTULO[importandoTudo]}…` : 'Confirmar importação'}
                    </button>
                  )}
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => setTelaSelecao(false)}>
                    Cancelar
                  </button>
                </div>
              </div>

              <div className="modal-body">
                {!todos && !lendo && (
                  <div
                    className="dropzone-arquivo"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleSoltarArquivo}
                  >
                    <p className="dropzone-arquivo-titulo">Arraste o arquivo aqui</p>
                    <p className="text-muted" style={{ fontSize: 12 }}>ou</p>
                    <button className="btn btn-primary" type="button" onClick={() => inputRef.current?.click()}>
                      ⭱ Escolher arquivo
                    </button>
                    <p style={{ fontSize: 12, opacity: 0.75, marginTop: 10 }}>
                      O Template Budget do ano (.xlsb, .xlsx ou .xlsm) — a ferramenta reconhece as abas de Receita e
                      Base Gastos e confere sozinha, aqui mesmo, assim que o arquivo for escolhido.
                    </p>
                  </div>
                )}

                {lendo && (
                  <div className="leitura-template">
                    <p style={{ margin: '0 0 12px', fontSize: 13, opacity: 0.75 }}>
                      {arquivo} — conferindo a estrutura das três abas antes de ler linha a linha.
                    </p>
                    <ol className="lista-etapas">
                      {ORDEM.map((t, i) => (
                        <Etapa key={t} numero={i + 1} titulo={ROTULO[t]} {...statusAba(estrutura?.[t])} />
                      ))}
                      <Etapa
                        numero={ORDEM.length + 1}
                        titulo="Lendo os lançamentos das três abas"
                        {...(erroLeitura
                          ? { estado: 'erro', detalhe: erroLeitura }
                          : { estado: 'carregando', detalhe: `lendo linha a linha… ${segundos}s` })}
                      />
                    </ol>
                    <p style={{ margin: '12px 0 0', fontSize: 12, opacity: 0.7 }}>
                      Pode deixar esta janela aberta — a leitura roda em segundo plano.
                    </p>
                  </div>
                )}

                {todos && (
                  <>
                    {comoTarget && (
                      <CardTargetsPacote
                        linhas={todos.despesa?.linhas ?? []}
                        anoTemplate={todos.despesa?.ano}
                        arquivo={arquivo}
                        responsavel={sessao?.user?.email}
                        onGravado={() => setGravados((n) => n + 1)}
                      />
                    )}

                    {!comoTarget && (
                      <>
                        {/* O status do arquivo é a primeira coisa a ver, antes
                            até dos cards — é ele que diz se vale a pena
                            continuar olhando o resto. */}
                        {registroDoArquivo && (
                          <AlertaStatus
                            registro={registroDoArquivo}
                            escopo="arquivo"
                            previa
                            onAbrir={() => setChecklistDoArquivo(true)}
                          />
                        )}
                        {registroDoArquivo && <div className="divisor-fino" />}

                        {tiposComErro.length > 0 && (
                          <div className="proto-banner" style={{ marginBottom: 16 }}>
                            ✕ Não consegui ler {tiposComErro.map((t) => ROTULO[t]).join(', ')}: veja o detalhe em
                            cada aba na Etapa de validação.
                          </div>
                        )}
                        {tiposVazios.length > 0 && (
                          <div className="proto-banner" style={{ marginBottom: 16 }}>
                            ⓘ {tiposVazios.map((t) => ROTULO[t]).join(', ')} não{' '}
                            {tiposVazios.length === 1 ? 'tem' : 'têm'} nenhuma linha com valor mensal preenchido
                            neste arquivo — nada para conferir.
                          </div>
                        )}

                        {resumo.tipos.length > 0 && (
                          <Indicadores
                            itens={[
                              { chave: 'linhas', rotulo: 'linhas a importar', valor: resumo.linhas, formato: 'inteiro' },
                              { chave: 'receita', rotulo: '(+) Revenue', valor: resumo.totais.receita ?? 0 },
                              { chave: 'despesa', rotulo: '(−) Expenses', valor: resumo.totais.despesa ?? 0 },
                              { chave: 'capex', rotulo: '(−) Capex', valor: resumo.totais.capex ?? 0 },
                              { chave: 'empresas', rotulo: 'empresas', valor: resumo.empresas, formato: 'inteiro' },
                              { chave: 'contas', rotulo: 'contas', valor: resumo.contas, formato: 'inteiro' },
                            ]}
                          />
                        )}

                        <div className="panel" style={{ marginBottom: 16 }}>
                          <div className="panel-header">
                            <BotaoRecolher chave="gestao-importacao-conferencia" rotulo="a conferência" />
                            <div>
                              <h2>Conferência do template</h2>
                              <p>
                                {arquivo}
                                {primeira?.ciclo && ` · ciclo ${primeira.ciclo.ano}`}
                                {primeira?.versao && ` / versão ${primeira.versao.nome}`}
                              </p>
                            </div>
                          </div>
                          <div className="panel-body">
                            {tiposComDado.map((t) => (
                              <CardTipo
                                key={`${chave}-${t}`}
                                ref={(el) => {
                                  cards.current[t] = el
                                }}
                                tipo={t}
                                lido={todos[t]}
                                arquivo={arquivo}
                                nomeTemplate={arquivo}
                                podeSolicitar={podeSolicitar}
                                onPrevia={(tipoDoCard, pv) => setPrevias((atual) => ({ ...atual, [tipoDoCard]: pv }))}
                                onRegistrar={registrar}
                                onDesfeito={desfeito}
                                onImportado={() => setGravados((n) => n + 1)}
                                // Capex grava separado, mas a conferência é
                                // visual: os pacotes dele seguem direto
                                // embaixo dos de Despesa, na mesma árvore —
                                // sem título nem seção próprios.
                                tituloOculto={t === 'capex' && tiposComDado.includes('despesa')}
                                tipoMesclado={t === 'despesa' && tiposComDado.includes('capex') ? 'capex' : null}
                              />
                            ))}

                            {resumo.empresasLista?.length > 0 && (
                              <div className="empresas-detectadas">
                                <strong>{resumo.empresasLista.length} empresa(s) detectada(s) no arquivo</strong>
                                <div className="empresas-detectadas-lista">
                                  {resumo.empresasLista.map((nome) => (
                                    <span key={nome} className="pill">{nome}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {checklistDoArquivo && registroDoArquivo && (
                          <ChecklistImportacao
                            registro={registroDoArquivo}
                            escopo="arquivo"
                            onFechar={() => setChecklistDoArquivo(false)}
                          />
                        )}

                        {!tiposComDado.length && !tiposComErro.length && (
                          <div className="empty-hint">
                            Nenhuma das três abas tinha lançamento para conferir neste arquivo.
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <HistoricoImportacoes versao={versaoHistorico} />

        <TemplatesRecusados versao={versaoHistorico} />

        {tutorialAberto && (
          <TutorialImportacao etapa={etapaTutorial} janela onFechar={() => setTutorialAberto(false)} />
        )}
      </div>
    </Layout>
  )
}
