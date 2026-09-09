import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from './ToastProvider'
import { agruparParaCadastro, solicitar, tabelaDisponivel } from '../lib/contasPendentesData'
import PainelResultado from './PainelResultado'
import { agruparPorEstrutura, anual } from '../lib/resultadoData'
import { useAuth } from './AuthProvider'
import {
  lerPlanilhaEmWorker,
  conferir,
  importar,
  apagarDoTipo,
  desfazer,
  TEMPLATE,
} from '../lib/importarTemplateOrcamento'

const brl = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Como o tipo se chama nas mensagens. O `rotulo` da tela é "Revenue"/"Expenses",
 * e usá-lo no meio de uma frase em português dava "10 lançamentos de revenue".
 */
const NOME = { receita: 'receita', despesa: 'despesa', capex: 'capex' }

/** Nota de rodapé específica de cada aba: o que entra e o que fica de fora. */
const NOTA = {
  receita:
    'Entra a receita bruta do template. A dedução não é gravada aqui: a ferramenta já tem o mapa de ' +
    'alíquotas, e o P&L trata dedução como linha própria. Produto e cliente vão para a descrição e as ' +
    'observações, porque a tabela ainda não tem coluna para eles.',
  despesa:
    'Entra o bloco de competência. O bloco de caixa que vem depois não é gravado — a ferramenta orça por ' +
    'competência. Os valores trocam de sinal: o template escreve gasto como negativo e aqui o gasto é ' +
    'guardado positivo, porque o P&L faz EBITDA = receita − despesa.',
  capex:
    'Entra o bloco de competência. O bloco de caixa que vem depois não é gravado. Quantidade e valor ' +
    'unitário vão para as observações, e os valores trocam de sinal como na Despesa.',
}

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/**
 * Os doze meses como barras. O total do ano nao mostra a forma: um valor que
 * caiu no mes errado passa batido. Doze colunas de numeros nao cabem na tabela,
 * entao vai o desenho, com os valores no title para quem precisar do numero.
 *
 * As barras sao escaladas pelo maior valor absoluto DA LINHA, nao do conjunto:
 * o que interessa aqui e a distribuicao dentro do contrato, e uma linha de
 * 264 mil achataria todas as outras.
 */
function Meses({ valores }) {
  const v = valores.map((x) => x.valor)
  const max = Math.max(...v.map(Math.abs), 1)
  const temNegativo = v.some((x) => x < 0)
  const A = 22
  const base = temNegativo ? A / 2 : A
  const titulo = v.map((x, i) => `${MES[i]} ${x.toLocaleString('pt-BR')}`).join('\n')

  return (
    <svg width={12 * 7} height={A} title={titulo} aria-label={titulo} style={{ display: 'block' }}>
      <title>{titulo}</title>
      {temNegativo && <line x1="0" y1={base} x2={12 * 7} y2={base} stroke="currentColor" opacity="0.2" />}
      {v.map((x, i) => {
        const h = (Math.abs(x) / max) * (temNegativo ? A / 2 : A)
        return (
          <rect
            key={i}
            x={i * 7}
            y={x < 0 ? base : base - h}
            width={5}
            height={Math.max(h, x === 0 ? 0 : 1)}
            fill={x < 0 ? 'var(--color-danger, #c0392b)' : 'var(--color-primary, #ff3d03)'}
            opacity={x === 0 ? 0.15 : 0.85}
          />
        )
      })}
      {v.every((x) => x === 0) && <rect x="0" y={base - 1} width={12 * 7} height="1" opacity="0.15" />}
    </svg>
  )
}

/** Um numero do resumo, com o rotulo embaixo. */
function Resumo({ rotulo, valor, alerta }) {
  return (
    <div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: alerta ? 'var(--color-danger, #c0392b)' : 'inherit',
        }}
      >
        {valor}
      </div>
      <div style={{ fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.6 }}>
        {rotulo}
      </div>
    </div>
  )
}

/**
 * Botão de upload do Template Budget nas telas de lançamento.
 *
 * O fluxo é em dois passos de propósito: lê e CONFERE, mostra o que casou e o
 * que não, e só grava depois de confirmar. Importar direto do arquivo criaria
 * lançamentos com empresa ou conta erradas sem ninguém ver.
 */
export default function ImportarTemplateOrcamento({ tipo, rotulo, anoCiclo, onImportado }) {
  const showToast = useToast()
  const inputRef = useRef(null)
  const [lendo, setLendo] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [previa, setPrevia] = useState(null)
  const [arquivo, setArquivo] = useState('')
  const [segundos, setSegundos] = useState(0)
  const [substituir, setSubstituir] = useState(false)
  const [ultima, setUltima] = useState(null)   // { ids, quantos } da importacao recem-feita
  const [desfazendo, setDesfazendo] = useState(false)
  const [podeSolicitar, setPodeSolicitar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviadas, setEnviadas] = useState(0)
  const { user } = useAuth()

  useEffect(() => {
    tabelaDisponivel().then(setPodeSolicitar)
  }, [])

  const aba = TEMPLATE[tipo]?.aba

  // Cronometro da leitura. Sao 20 a 45 segundos conforme o tamanho da planilha,
  // e sem nenhum sinal de progresso a pessoa acha que travou e clica de novo.
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

    setLendo(true)
    setPrevia(null)
    setSubstituir(false)
    setUltima(null)
    setEnviadas(0)
    try {
      const lido = await lerPlanilhaEmWorker(await file.arrayBuffer(), tipo)
      if (!lido.linhas.length) {
        showToast(`A aba "${lido.aba}" não tem nenhuma linha preenchida com valor mensal.`, 'warning')
        return
      }
      setArquivo(file.name)
      setPrevia({ ...(await conferir(lido)), ano: lido.ano, ignoradas: lido.ignoradas })
    } catch (err) {
      showToast(`Não consegui ler a planilha: ${err.message}`, 'error')
    } finally {
      setLendo(false)
    }
  }

  async function handleConfirmar() {
    setGravando(true)
    try {
      let apagados = 0
      if (substituir && previa.jaExistem) apagados = await apagarDoTipo(previa.versao.id, tipo)
      const ids = await importar([...previa.prontas, ...previa.marcadas], previa.versao.id, tipo)
      const oQue = NOME[tipo] ?? tipo
      showToast(
        apagados
          ? `${apagados} lançamento(s) de ${oQue} apagado(s) e ${ids.length} importado(s).`
          : `${ids.length} lançamento(s) de ${oQue} importado(s).`,
        'success'
      )
      // A substituicao apagou linhas que o desfazer nao traz de volta; oferecer
      // "desfazer" ali seria mentira.
      setUltima(apagados ? null : { ids, quantos: ids.length })
      setPrevia(null)
      onImportado?.()
    } catch (err) {
      showToast(`Erro ao importar: ${err.message}`, 'error')
    } finally {
      setGravando(false)
    }
  }

  async function handleEnviarCadastro() {
    setEnviando(true)
    try {
      const pedidos = agruparParaCadastro(previa.marcadas, tipo, arquivo)
      const n = await solicitar(pedidos, user?.email)
      setEnviadas(n || pedidos.length)
      showToast(
        n
          ? `${n} conta(s) enviada(s) para aprovação de cadastro.`
          : 'Essas contas já estavam na fila de aprovação.',
        n ? 'success' : 'warning'
      )
    } catch (err) {
      showToast(`Não consegui enviar: ${err.message}`, 'error')
    } finally {
      setEnviando(false)
    }
  }

  async function handleDesfazer() {
    setDesfazendo(true)
    try {
      const n = await desfazer(ultima.ids)
      showToast(`${n} lançamento(s) desfeito(s).`, 'success')
      setUltima(null)
      onImportado?.()
    } catch (err) {
      showToast(`Não consegui desfazer: ${err.message}`, 'error')
    } finally {
      setDesfazendo(false)
    }
  }

  const aImportar = previa ? [...previa.prontas, ...previa.marcadas] : []

  /**
   * O mesmo painel do Resultado, mas do que AINDA vai entrar. Antes a
   * conferência mostrava linha a linha e o total; não dava para ver o que o
   * arquivo faz com o consolidado nem com cada torre — que é a pergunta de quem
   * aprova a importação.
   */
  const painel = (() => {
    if (!previa || !aImportar.length) return null
    const h = previa.hierarquia
    const itens = aImportar.map((p) => ({
      tipo,
      meses: p.valores.map((v) => v.valor),
      bu: { id: p.empresa.bu_id, nome: h?.bu.get(p.empresa.bu_id) },
      torre: { id: p.empresa.torre_id, nome: h?.torre.get(p.empresa.torre_id) },
      sub: { id: p.empresa.sub_torre_id, nome: h?.sub.get(p.empresa.sub_torre_id) },
      empresa: { id: p.empresa.id, nome: p.empresa.nome },
    }))
    const { arvore } = agruparPorEstrutura(itens)
    const soma = arvore.reduce((a, n) => a + anual(n[tipo]), 0)
    return {
      arvore,
      consolidado: {
        receita: tipo === 'receita' ? soma : 0,
        ebitdaAposCapex: tipo === 'receita' ? soma : -soma,
      },
    }
  })()
  // Um pedido por RÓTULO: 81 linhas de "CS dedicado" são um cadastro só.
  const aCadastrar = previa ? agruparParaCadastro(previa.marcadas, tipo, arquivo) : []
  const total = aImportar.reduce((a, p) => a + p.total, 0)
  const empresas = new Set(aImportar.map((p) => p.empresa.id)).size
  const contas = new Set(previa?.prontas.map((p) => p.conta.id) ?? []).size
  const semVersao = previa && !previa.versao
  const anoDivergente = previa && anoCiclo && previa.ano !== anoCiclo
  const temDetalhe = tipo !== 'receita'

  return (
    <>
      <button
        className="btn btn-secondary btn-sm"
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={lendo}
      >
        {lendo ? `Lendo planilha… ${segundos}s` : '⭱ Importar Template'}
      </button>
      {lendo && (
        <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.7 }}>
          a leitura roda em segundo plano — pode continuar usando a tela
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsb,.xlsx,.xlsm"
        style={{ display: 'none' }}
        onChange={handleArquivo}
      />

      {ultima && !previa && (
        <div
          className="flex-row"
          style={{
            marginTop: 12,
            padding: '9px 12px',
            gap: 12,
            alignItems: 'center',
            borderRadius: 6,
            background: 'var(--color-surface-alt, #f2f4f7)',
            border: '1px solid var(--color-border, #e2e5ea)',
          }}
        >
          <span style={{ fontSize: 13 }}>
            {ultima.quantos} lançamento(s) importado(s) agora.
          </span>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={handleDesfazer}
            disabled={desfazendo}
          >
            {desfazendo ? 'Desfazendo…' : '↶ Desfazer'}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => setUltima(null)}
            style={{ marginLeft: 'auto' }}
          >
            Dispensar
          </button>
        </div>
      )}

      {previa && (
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="panel-header">
            <div>
              <h2>Conferência da importação</h2>
              <p>
                {arquivo} · aba {aba}
                {previa.ciclo && ` · ciclo ${previa.ciclo.ano}`}
                {previa.versao && ` / versão ${previa.versao.nome}`}
              </p>
            </div>
            <div className="flex-row" style={{ gap: 6 }}>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setPrevia(null)}>
                Cancelar
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
          </div>

          <div className="panel-body">
            {/* O risco silencioso: a gravacao so insere. Importar o mesmo
                arquivo de novo dobra o orcamento sem nenhum aviso. */}
            {previa.jaExistem > 0 && (
              <div className="proto-banner" style={{ marginBottom: 12 }}>
                ⚠ Esta versão já tem <strong>{previa.jaExistem}</strong> lançamento(s) de {NOME[tipo]}.
                Importar vai <strong>somar</strong> aos que já existem, não substituir.
                <label style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={substituir}
                    onChange={(e) => setSubstituir(e.target.checked)}
                    style={{ marginRight: 6 }}
                  />
                  Apagar os {previa.jaExistem} antes de importar
                </label>
                {substituir && (
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    Vão embora <strong>todos</strong> os lançamentos de {NOME[tipo]} desta versão, inclusive os
                    lançados à mão. Não há como desfazer.
                  </div>
                )}
              </div>
            )}

            {semVersao && (
              <div className="proto-banner" style={{ marginBottom: 12 }}>
                ⓘ Não há versão ativa num ciclo aberto. Crie uma em Budget-Settings antes de importar.
              </div>
            )}

            {anoDivergente && (
              <div className="proto-banner" style={{ marginBottom: 12 }}>
                ⚠ O cabeçalho da aba {aba} está em {previa.ano} e o ciclo aberto é {anoCiclo}. Os meses entram
                por posição (1ª coluna = janeiro), então os valores vão para o ciclo {anoCiclo} de qualquer
                forma — confira se é isso mesmo antes de confirmar.
              </div>
            )}

            {previa.marcadas.length > 0 && (
              <div className="proto-banner" style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 8 }}>
                  <strong>Contas não cadastradas</strong> — {previa.marcadas.length} linha(s) entram sem conta,
                  marcadas nas observações. O valor não fica de fora do orçamento, mas a linha só pode ser
                  salva na grade depois que a conta existir.
                </div>

                <table className="data-table" style={{ marginBottom: 10 }}>
                  <thead>
                    <tr>
                      <th>CONTA</th>
                      <th>DESCRIÇÃO</th>
                      <th>MOTIVO</th>
                      <th className="text-right">VALOR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aCadastrar.map((c) => (
                      <tr key={c.rotulo}>
                        <td><strong>{c.rotulo}</strong></td>
                        <td style={{ fontSize: 12 }}>{c.descricao}</td>
                        <td style={{ fontSize: 12 }}>{c.motivo}</td>
                        <td className="text-right">{brl(c.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {enviadas > 0 ? (
                  <div style={{ fontSize: 13 }}>
                    ✓ {enviadas} conta(s) na fila. Acompanhe em{' '}
                    <Link to="/pendencia-cadastros">Pendência de Cadastros</Link>.
                  </div>
                ) : podeSolicitar ? (
                  <div className="flex-row" style={{ gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 13 }}>Deseja enviar para aprovação de cadastro?</span>
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={handleEnviarCadastro}
                      disabled={enviando}
                    >
                      {enviando ? 'Enviando…' : `Enviar ${aCadastrar.length} conta(s) para aprovação`}
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    A fila de aprovação ainda não está disponível — falta rodar
                    supabase/migrations/2026-09-09-pendencia-de-cadastros.sql.
                  </div>
                )}
              </div>
            )}

            {previa.fora.length > 0 && (
              <div className="proto-banner" style={{ marginBottom: 12 }}>
                ⓘ {previa.fora.length} linha(s) <strong>não entram</strong>: sem empresa cadastrada não há como
                gravar, porque a BU do lançamento vem dela. Cadastre a empresa e importe de novo.
              </div>
            )}

            {/* Resumo antes da tabela: com muitas linhas, o total do rodape
                fica longe demais para servir de conferencia. */}
            <div
              className="flex-row"
              style={{
                gap: 20,
                flexWrap: 'wrap',
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 6,
                background: 'var(--color-surface-alt, #f2f4f7)',
                border: '1px solid var(--color-border, #e2e5ea)',
              }}
            >
              <Resumo rotulo="linhas" valor={aImportar.length} />
              <Resumo rotulo="total do ano" valor={brl(total)} />
              <Resumo rotulo="empresas" valor={empresas} />
              <Resumo rotulo="contas" valor={contas} />
              {previa.marcadas.length > 0 && (
                <Resumo rotulo="sem conta (entram marcadas)" valor={previa.marcadas.length} alerta />
              )}
              {previa.fora.length > 0 && (
                <Resumo rotulo="fora (sem empresa)" valor={previa.fora.length} alerta />
              )}
              {previa.ignoradas > 0 && <Resumo rotulo="ignoradas (sem valor)" valor={previa.ignoradas} />}
            </div>

            {painel && (
              <div style={{ marginBottom: 16 }}>
                <PainelResultado
                  arvore={painel.arvore}
                  consolidado={painel.consolidado}
                  titulo="Como fica o resultado"
                  subtitulo={`[ BRL M ] · o que estas ${aImportar.length} linha(s) somam por estrutura, antes de gravar`}
                />
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>LINHA</th>
                    <th>EMPRESA</th>
                    <th>CONTA</th>
                    <th>DESCRIÇÃO</th>
                    {temDetalhe && <th>C. CUSTO · FORNECEDOR</th>}
                    <th>JAN — DEZ</th>
                    <th className="text-right">TOTAL ANO</th>
                    <th>SITUAÇÃO</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.prontas.map((p) => (
                    <tr key={`ok-${p.linha}`}>
                      <td>{p.linha}</td>
                      <td><strong>{p.empresa.nome}</strong></td>
                      <td style={{ fontSize: 12 }}>
                        {p.conta.codigo} {p.conta.nome}
                        <div style={{ opacity: 0.6 }}>de {p.contaCodigo || p.contaRotulo}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{p.descricao || '—'}</td>
                      {temDetalhe && (
                        <td style={{ fontSize: 12 }}>
                          {[p.centroCusto, p.fornecedor].filter(Boolean).join(' · ') || '—'}
                        </td>
                      )}
                      <td><Meses valores={p.valores} /></td>
                      <td className="text-right">{brl(p.total)}</td>
                      <td style={{ color: 'var(--color-success, #1a7f47)' }}>✓ resolvida</td>
                    </tr>
                  ))}
                  {[...previa.marcadas, ...previa.fora].map((p) => (
                    <tr key={`erro-${p.linha}`} style={{ background: 'var(--color-surface-alt, #fff6f4)' }}>
                      <td>{p.linha}</td>
                      <td>{(typeof p.empresa === 'object' ? p.empresa?.nome : p.empresa) || '—'}</td>
                      <td style={{ fontSize: 12 }}>{p.contaCodigo || p.contaRotulo || '—'}</td>
                      <td style={{ fontSize: 12 }}>{p.descricao || '—'}</td>
                      {temDetalhe && (
                        <td style={{ fontSize: 12 }}>
                          {[p.centroCusto, p.fornecedor].filter(Boolean).join(' · ') || '—'}
                        </td>
                      )}
                      <td><Meses valores={p.valores} /></td>
                      <td className="text-right">{brl(p.total)}</td>
                      <td style={{ color: 'var(--color-danger, #c0392b)', fontSize: 12 }}>
                        {p.empresa && typeof p.empresa === 'object' ? '⚠ entra sem conta — ' : '✕ não entra — '}
                        {p.falhas.join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {previa.prontas.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={temDetalhe ? 6 : 5}><strong>Total a importar</strong></td>
                      <td className="text-right"><strong>{brl(total)}</strong></td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <p style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>{NOTA[tipo]}</p>
          </div>
        </div>
      )}
    </>
  )
}
