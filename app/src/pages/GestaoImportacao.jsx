import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import ImportWizard from '../components/ImportWizard'
import ProgressoGravacao from '../components/ProgressoGravacao'
import ChecklistImportacao from '../components/ChecklistImportacao'
import AlertaStatus from '../components/AlertaStatus'
import TutorialImportacao from '../components/TutorialImportacao'
import HistoricoImportacoes from '../components/HistoricoImportacoes'
import SeletorFormato from '../components/SeletorFormato'
import CardTargetsPacote from '../components/CardTargetsPacote'
import { useToast } from '../components/ToastProvider'
import { useAuth } from '../components/AuthProvider'
import { agruparParaCadastro, solicitar, tabelaDisponivel } from '../lib/contasPendentesData'
import { createCiclo } from '../lib/ciclosData'
import {
  lerTodosOsTiposEmWorker,
  conferir,
  importar,
  apagarDoTipo,
  desfazer,
} from '../lib/importarTemplateOrcamento'
import { registrarImportacao, marcarDesfeito, resumoDaImportacao } from '../lib/importacoesData'
import { FORMATOS, conferirFormato, detectarFormato, nomesDasAbas } from '../lib/formatosTemplate'
import { lerTargetsPacote } from '../lib/lerTemplatePacoteiro'
import { useUnidade } from '../components/UnidadeProvider'

const ROTULO = { receita: 'Receita (Revenue)', despesa: 'Despesa (Expenses)', capex: 'Capex' }
const NOME = { receita: 'receita', despesa: 'despesa', capex: 'capex' }
const ORDEM = ['receita', 'despesa', 'capex']

const brl = (v) => `R$ ${Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Igual ao `semCadastro` de ImportarTemplateOrcamento: só vai para aprovação
 * quem tem dado de verdade e não é só uma conta com classificação diferente.
 */
const semCadastro = (m) =>
  Boolean((m.contaCodigo || m.contaRotulo || '').trim()) &&
  !(m.falhas ?? []).some((f) => f.includes('está no plano como'))

/**
 * Uma conferência por tipo, lado a lado na mesma tela. É a mesma lógica de
 * confirmar/substituir/desfazer da importação de cada módulo de lançamento —
 * só que aqui os três correm a partir de UM upload já lido, em vez de três
 * telas com um "Importar Template" cada uma.
 */
function CardTipo({ tipo, lido, arquivo, podeSolicitar, onImportado, onRegistrar, onDesfeito }) {
  const showToast = useToast()
  const { comMoeda } = useUnidade()
  const { sessao } = useAuth()
  const email = sessao?.user?.email
  const [previa, setPrevia] = useState(null)
  const [conferindo, setConferindo] = useState(true)
  const [erroConferencia, setErroConferencia] = useState(null)
  const [gravando, setGravando] = useState(false)
  const [progresso, setProgresso] = useState(null)
  const [substituir, setSubstituir] = useState(false)
  const [criandoCiclo, setCriandoCiclo] = useState(false)
  const [ultima, setUltima] = useState(null)
  const [desfazendo, setDesfazendo] = useState(false)
  const [checklistAberto, setChecklistAberto] = useState(false)
  const [statusPrevia, setStatusPrevia] = useState(false)

  useEffect(() => {
    let cancelado = false
    async function rodar() {
      setConferindo(true)
      setErroConferencia(null)
      try {
        const p = { ...(await conferir(lido)), ano: lido.ano, ignoradas: lido.ignoradas }
        if (!cancelado) setPrevia(p)
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

  async function handleCriarCiclo() {
    setCriandoCiclo(true)
    try {
      await createCiclo(previa.cicloFaltando)
      setPrevia({ ...(await conferir(lido)), ano: lido.ano, ignoradas: lido.ignoradas })
      showToast(`Ciclo ${lido.ano} criado com a versão Original.`, 'success')
    } catch (err) {
      showToast(`Não consegui criar o ciclo: ${err.message}`, 'error')
    } finally {
      setCriandoCiclo(false)
    }
  }

  async function handleConfirmar() {
    // A versão já tinha lançamentos deste tipo e a pessoa não marcou
    // substituir: entra como pendência no checklist, pode ter dobrado.
    const somouEmCima = Boolean(previa.jaExistem) && !substituir
    setGravando(true)
    setProgresso({ feitos: 0, total: 0, fase: substituir && previa.jaExistem ? 'apagando' : 'cabecalhos' })
    try {
      let apagados = 0
      if (substituir && previa.jaExistem) apagados = await apagarDoTipo(previa.versao.id, tipo)
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
        (apagados
          ? `${apagados} lançamento(s) de ${oQue} apagado(s) e ${ids.length} importado(s).`
          : `${ids.length} lançamento(s) de ${oQue} importado(s).`) +
          (enviadas ? ` ${enviadas} conta(s) enviada(s) para aprovação de cadastro.` : ''),
        erroEnvio ? 'warning' : 'success'
      )
      if (erroEnvio) showToast(`As linhas entraram, mas não consegui enviar as contas para aprovação: ${erroEnvio}`, 'error')

      // O histórico vem depois de gravar e num try próprio: falhar aqui não
      // desfaz nem invalida a importação, que já está no banco.
      try {
        await onRegistrar?.(tipo, {
          linhas: [...previa.prontas, ...previa.marcadas],
          apagados,
          fora: previa.fora.length,
          marcadas: previa.marcadas.length,
          somouEmCima,
          cadastros: previa.cadastros,
          ano: lido.ano,
          ciclo: previa.ciclo,
          versao: previa.versao,
        })
      } catch (err) {
        showToast(`Importado, mas não consegui registrar no histórico: ${err.message}`, 'warning')
      }

      setUltima({
        ids: apagados ? null : ids,
        quantos: ids.length,
        enviadas,
        // Abre a janela do checklist assim que a gravação termina.
        resumo: resumoDaImportacao({
          ano: lido.ano,
          versao: previa.versao,
          tipo,
          linhas: [...previa.prontas, ...previa.marcadas],
          fora: previa.fora.length,
          marcadas: previa.marcadas.length,
          apagados,
          somouEmCima,
          cadastros: previa.cadastros,
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

  // O status já na conferência: é aqui que dá para desistir e corrigir a
  // planilha, em vez de descobrir o impedimento depois de gravar.
  const resumoPrevia = previa
    ? resumoDaImportacao({
        ano: lido.ano,
        versao: previa.versao,
        tipo,
        linhas: [...previa.prontas, ...previa.marcadas],
        fora: previa.fora.length,
        marcadas: previa.marcadas.length,
        apagados: 0,
        somouEmCima: Boolean(previa.jaExistem) && !substituir,
        cadastros: previa.cadastros,
      })
    : null

  const aImportar = previa ? [...previa.prontas, ...previa.marcadas] : []
  const total = aImportar.reduce((a, p) => a + p.total, 0)
  const empresas = new Set(aImportar.map((p) => p.empresa.id)).size
  const semVersao = previa && !previa.versao
  const paraAprovacao = previa ? agruparParaCadastro(previa.marcadas.filter(semCadastro), tipo, arquivo) : []

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-header">
        <div>
          <h2>{ROTULO[tipo]}</h2>
          <p>
            aba {lido.aba}
            {previa?.ciclo && ` · ciclo ${previa.ciclo.ano}`}
            {previa?.versao && ` / versão ${previa.versao.nome}`}
          </p>
        </div>
        {previa && (
          <div className="flex-row" style={{ gap: 6 }}>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setPrevia(null)} disabled={gravando}>
              Ignorar
            </button>
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={handleConfirmar}
              disabled={gravando || !aImportar.length || semVersao}
            >
              {gravando
                ? 'Importando…'
                : substituir && previa.jaExistem
                ? `Substituir ${previa.jaExistem} e importar ${aImportar.length}`
                : `Importar ${aImportar.length} linha(s)`}
            </button>
          </div>
        )}
      </div>

      <div className="panel-body">
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

        {statusPrevia && resumoPrevia && (
          <ChecklistImportacao registro={resumoPrevia} escopo="tipo" onFechar={() => setStatusPrevia(false)} />
        )}

        {previa && (
          <>
            {previa.jaExistem > 0 && (
              <div className="proto-banner" style={{ marginBottom: 12 }}>
                ⚠ Esta versão já tem <strong>{previa.jaExistem}</strong> lançamento(s) de {NOME[tipo]}. Importar vai{' '}
                <strong>somar</strong> aos que já existem, não substituir.
                <label style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} style={{ marginRight: 6 }} />
                  Apagar os {previa.jaExistem} antes de importar
                </label>
              </div>
            )}

            {previa.cicloFaltando ? (
              <div className="proto-banner" style={{ marginBottom: 12 }}>
                ⓘ Este arquivo é de <strong>{previa.cicloFaltando}</strong> e ainda não existe o ciclo {previa.cicloFaltando}.
                {' '}
                <button className="btn btn-primary btn-sm" type="button" onClick={handleCriarCiclo} disabled={criandoCiclo}>
                  {criandoCiclo ? 'Criando…' : `Criar ciclo ${previa.cicloFaltando}`}
                </button>
              </div>
            ) : (
              semVersao && (
                <div className="proto-banner" style={{ marginBottom: 12 }}>
                  ⓘ O ciclo {previa.ano} não tem versão. Crie uma em Budget-Settings antes de importar.
                </div>
              )
            )}

            {previa.marcadas.length > 0 && (
              <div className="proto-banner" style={{ marginBottom: 12 }}>
                <strong>{previa.marcadas.length} linha(s)</strong> entram sem conta, marcadas nas observações — o valor
                não fica de fora, mas só pode ser salvo na grade depois que a conta existir.
                {podeSolicitar ? (
                  paraAprovacao.length > 0 && (
                    <>
                      {' '}Ao confirmar, {paraAprovacao.length === 1 ? '1 conta' : `${paraAprovacao.length} contas`} sem
                      cadastro {paraAprovacao.length === 1 ? 'será enviada' : 'serão enviadas'} para aprovação.
                    </>
                  )
                ) : (
                  <span style={{ display: 'block', fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                    A fila de aprovação ainda não está disponível — falta rodar
                    supabase/migrations/2026-09-10-schema-completo-do-template.sql.
                  </span>
                )}
              </div>
            )}

            {previa.outroModulo?.length > 0 && (
              <div className="proto-banner" style={{ marginBottom: 12 }}>
                ⓘ {previa.outroModulo.length} linha(s) desta aba são de{' '}
                <strong>{previa.outroModulo[0].destino === 'capex' ? 'Capex' : 'Despesa'}</strong> e ficam para o card de{' '}
                {previa.outroModulo[0].destino === 'capex' ? 'Capex' : 'Despesa'} acima ou abaixo — o mesmo upload entra
                nos dois, cada um com a sua parte, sem duplicar.
              </div>
            )}

            {previa.fora.length > 0 && (
              <div className="proto-banner" style={{ marginBottom: 12 }}>
                ⓘ {previa.fora.length} linha(s) não entram: sem empresa cadastrada não há como gravar.
              </div>
            )}

            {resumoPrevia && (
              <AlertaStatus
                registro={resumoPrevia}
                escopo="tipo"
                previa
                onAbrir={() => setStatusPrevia(true)}
              />
            )}

            <div className="flex-row" style={{ gap: 20, flexWrap: 'wrap', marginBottom: 12, padding: '10px 12px', borderRadius: 6, background: 'var(--color-surface-alt, #f2f4f7)', border: '1px solid var(--color-border, #e2e5ea)' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{aImportar.length}</div>
                <div style={{ fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.6 }}>linhas</div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{comMoeda(total)}</div>
                <div style={{ fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.6 }}>total do ano</div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{empresas}</div>
                <div style={{ fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.6 }}>empresas</div>
              </div>
            </div>

            {(previa.prontas.length > 0 || previa.marcadas.length > 0) && (
              <div className="rolagem-x">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>EMPRESA</th>
                      <th>CONTA</th>
                      <th className="text-right">TOTAL ANO</th>
                      <th>SITUAÇÃO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.prontas.slice(0, 200).map((p) => (
                      <tr key={`ok-${p.linha}`}>
                        <td><strong>{p.empresa.nome}</strong></td>
                        <td style={{ fontSize: 12 }}>{p.conta.codigo} {p.conta.nome}</td>
                        <td className="text-right">{brl(p.total)}</td>
                        <td style={{ color: 'var(--color-success, #1a7f47)' }}>✓ resolvida</td>
                      </tr>
                    ))}
                    {previa.marcadas.map((p) => (
                      <tr key={`marcada-${p.linha}`} style={{ background: 'var(--color-surface-alt, #fff6f4)' }}>
                        <td>{typeof p.empresa === 'object' ? p.empresa?.nome : p.empresa}</td>
                        <td style={{ fontSize: 12 }}>{p.contaCodigo || p.contaRotulo || '—'}</td>
                        <td className="text-right">{brl(p.total)}</td>
                        <td style={{ color: 'var(--color-danger, #c0392b)', fontSize: 12 }}>
                          ⚠ entra sem conta — {p.falhas.join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previa.prontas.length > 200 && (
                  <p style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                    Mostrando as primeiras 200 de {previa.prontas.length} linhas resolvidas — o total acima já conta
                    todas.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
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
  // Qual dos quatro templates é este arquivo, e por que a ferramenta acha isso.
  const [formato, setFormato] = useState('empresas')
  const [deteccao, setDeteccao] = useState(null)
  const [targets, setTargets] = useState(null)
  const [lendo, setLendo] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [wizardAberto, setWizardAberto] = useState(false)
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
  const { sessao } = useAuth()
  // Um registro de histórico por upload: o primeiro tipo importado cria, os
  // seguintes acrescentam. A fila impede dois cards de criarem dois registros
  // ao confirmar quase juntos.
  const registro = useRef({ id: null, fila: Promise.resolve() })
  // O File fica guardado para reler quando a pessoa troca o formato na mão.
  const arquivoRef = useRef(null)

  useEffect(() => {
    tabelaDisponivel().then(setPodeSolicitar)
  }, [])

  useEffect(() => {
    if (!lendo) return undefined
    setSegundos(0)
    const t = setInterval(() => setSegundos((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [lendo])

  async function handleArquivo(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setArquivo(file.name)
    setTamanho(file.size)
    arquivoRef.current = file
    registro.current = { id: null, fila: Promise.resolve() }
    setGravados(0)

    // O formato antes da leitura pesada: é ele que diz o que ler. Só os nomes
    // das abas são abertos aqui, sem parsear nenhuma — é rápido.
    let escolhido = 'empresas'
    try {
      const d = detectarFormato(nomesDasAbas(await file.arrayBuffer()), file.name)
      escolhido = d.formato
      setDeteccao(d)
    } catch {
      setDeteccao(null)
    }
    setFormato(escolhido)
    await ler(file, escolhido)
  }

  /** Lê o arquivo do jeito que o formato pede. */
  async function ler(file, formatoId) {
    setLendo(true)
    setTodos(null)
    setTargets(null)
    setEstrutura(null)
    setErroLeitura(null)
    const paraTarget = FORMATOS[formatoId]?.destino === 'target'
    setWizardAberto(!paraTarget)
    try {
      if (paraTarget) {
        // O template de pacoteiro é uma linha por pacote: cabe na thread
        // principal, sem worker nem assistente de etapas.
        setTargets(lerTargetsPacote(await file.arrayBuffer()))
      } else {
        setTodos(await lerTodosOsTiposEmWorker(await file.arrayBuffer(), setEstrutura))
      }
      setChave((c) => c + 1)
      setWizardAberto(false)
    } catch (err) {
      setErroLeitura(err.message)
      showToast(`Não consegui ler a planilha: ${err.message}`, 'error')
    } finally {
      setLendo(false)
    }
  }

  /** Trocar o formato na mão relê o arquivo: o que se lê depende dele. */
  async function trocarFormato(novo) {
    setFormato(novo)
    setDeteccao(null)
    if (arquivoRef.current) await ler(arquivoRef.current, novo)
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
        formato,
        usuarioEmail: sessao?.user?.email,
      })
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
  const etapaTutorial = gravados ? 5 : todos || targets ? 4 : lendo ? 3 : 1

  const tiposComDado = todos ? ORDEM.filter((t) => !todos[t].erro && todos[t].linhas.length > 0) : []
  const tiposVazios = todos ? ORDEM.filter((t) => !todos[t].erro && !todos[t].linhas.length) : []
  const tiposComErro = todos ? ORDEM.filter((t) => todos[t].erro) : []

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Gestão de Importação</h1>
          <p>
            Suba o template uma vez — a ferramenta reconhece qual dos quatro é e confere o que aquele formato tem de
            trazer.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => setTutorialAberto(true)}>
          ? Como importar
        </button>
        <button className="btn btn-primary btn-sm" type="button" onClick={() => inputRef.current?.click()} disabled={lendo}>
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

      <ImportWizard
        aberto={wizardAberto}
        arquivo={arquivo}
        tipo={null}
        estrutura={estrutura}
        lendo={lendo}
        segundos={segundos}
        erro={erroLeitura}
        onFechar={() => setWizardAberto(false)}
      />

      <div className="content">
        {(todos || targets) && (
          <SeletorFormato
            formato={formato}
            deteccao={deteccao}
            aviso={todos ? conferirFormato(formato, todos) : null}
            onChange={trocarFormato}
          />
        )}

        {!todos && !targets && !lendo && <TutorialImportacao etapa={etapaTutorial} />}

        {targets && (
          <CardTargetsPacote lido={targets} arquivo={arquivo} onGravado={() => setGravados((n) => n + 1)} />
        )}

        {todos && (
          <>
            {tiposComErro.length > 0 && (
              <div className="proto-banner" style={{ marginBottom: 16 }}>
                ✕ Não consegui ler {tiposComErro.map((t) => ROTULO[t]).join(', ')}: veja o detalhe em cada aba na
                Etapa de validação.
              </div>
            )}
            {tiposVazios.length > 0 && (
              <div className="proto-banner" style={{ marginBottom: 16 }}>
                ⓘ {tiposVazios.map((t) => ROTULO[t]).join(', ')} não {tiposVazios.length === 1 ? 'tem' : 'têm'} nenhuma
                linha com valor mensal preenchido neste arquivo — nada para conferir.
              </div>
            )}

            {tiposComDado.map((t) => (
              <CardTipo
                key={`${chave}-${t}`}
                tipo={t}
                lido={todos[t]}
                arquivo={arquivo}
                podeSolicitar={podeSolicitar}
                onRegistrar={registrar}
                onDesfeito={desfeito}
                onImportado={() => setGravados((n) => n + 1)}
              />
            ))}

            {!tiposComDado.length && !tiposComErro.length && (
              <div className="empty-hint">Nenhuma das três abas tinha lançamento para conferir neste arquivo.</div>
            )}
          </>
        )}

        <HistoricoImportacoes versao={versaoHistorico} />

        {tutorialAberto && (
          <TutorialImportacao etapa={etapaTutorial} janela onFechar={() => setTutorialAberto(false)} />
        )}
      </div>
    </Layout>
  )
}
