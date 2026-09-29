import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import FiltroBotoes from '../components/FiltroBotoes'
import BotaoUnidade from '../components/BotaoUnidade'
import { useToast } from '../components/ToastProvider'
import { useUnidade } from '../components/UnidadeProvider'
import { fetchCiclosResultado, versaoReferencia } from '../lib/resultadoData'
import { fetchVersaoAtual } from '../lib/lancamentosData'
import { fetchDeepDive, fetchTemplatesImportados, agruparTemplates, rodarChecks, piorCor } from '../lib/deepDive'
import { LIBERACOES } from '../lib/importacoesData'
import { exportarExcel } from '../lib/excelUtils'

const umaCasa = (v) => Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Quantas linhas fora a tabela mostra antes de mandar exportar. */
const LIMITE_TABELA = 100

const DIZ = {
  verde: 'dentro da regra',
  amarelo: 'pouca coisa fora',
  vermelho: 'fora da regra',
  cinza: 'nada para conferir',
}

/** A bandeira redonda da lista e do menu, com texto para leitor de tela. */
function Farol({ cor }) {
  return <span className={`bolinha ${cor}`} title={DIZ[cor]} aria-label={DIZ[cor]} role="img" />
}

/** O resumo de um check, na linha do menu. */
function resumirCheck(c) {
  const base =
    c.nEscopo === 0 ? 'nada para conferir' : c.nFora ? `${c.nFora} de ${c.nEscopo} fora` : `${c.nEscopo} linha(s) ok`
  if (c.medida && c.medida.valor !== null) return `${base} · ${c.medida.rotulo}: ${umaCasa(c.medida.valor)}%`
  return base
}

/**
 * Deep Dive: a qualidade da classificação do orçamento, template por
 * template.
 *
 * À esquerda, os templates com a bandeira de cada um; ao escolher um, o menu
 * dos checks abre ao lado, e o check escolhido mostra as linhas que fogem da
 * regra. As regras são as do Plano de Contas do template — ver `deepDive.js`.
 *
 * Um "template" aqui é o conjunto de linhas de uma empresa dentro da versão:
 * é o que uma pessoa preenche, corrige e reenvia. Enquanto o histórico de
 * importação não amarrar cada lançamento ao arquivo que o trouxe, é o recorte
 * mais próximo do arquivo que o banco sabe reconstruir.
 */
export default function DeepDive() {
  const showToast = useToast()
  const { numero, u } = useUnidade()
  const [ciclos, setCiclos] = useState([])
  const [cicloId, setCicloId] = useState('')
  const [versaoId, setVersaoId] = useState('')
  const [linhas, setLinhas] = useState(null)
  const [registros, setRegistros] = useState([])
  // Por que a lista pode não ter arquivo nenhum: as duas migrações.
  const [faltaMigracao, setFaltaMigracao] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [templateId, setTemplateId] = useState(null)
  const [checkId, setCheckId] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [cs, va] = await Promise.all([fetchCiclosResultado(), fetchVersaoAtual()])
        setCiclos(cs)
        setCicloId(va?.ciclo?.id ?? cs[0]?.id ?? '')
      } catch (err) {
        showToast(`Erro ao carregar os ciclos: ${err.message}`, 'error')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ciclo = ciclos.find((c) => c.id === cicloId) ?? null
  const versoes = ciclo?.versao ?? []
  const versao = versoes.find((v) => v.id === versaoId) ?? versaoReferencia(ciclo)

  useEffect(() => {
    if (!versao?.id) return
    let cancelado = false
    ;(async () => {
      setCarregando(true)
      try {
        const [dados, tpl] = await Promise.all([fetchDeepDive(versao.id), fetchTemplatesImportados(versao.id)])
        if (cancelado) return
        setLinhas(dados)
        setRegistros(tpl.registros)
        setFaltaMigracao(tpl.temHistorico && tpl.temAmarracao ? null : tpl)
        setTemplateId(null)
        setCheckId(null)
      } catch (err) {
        if (!cancelado) showToast(`Erro ao ler os lançamentos: ${err.message}`, 'error')
      } finally {
        if (!cancelado) setCarregando(false)
      }
    })()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao?.id])

  const templates = useMemo(() => (linhas ? agruparTemplates(linhas, registros) : []), [linhas, registros])
  const quantosArquivos = templates.filter((t) => t.origem === 'arquivo').length
  // O consolidado é um "template" a mais, no topo: é por ele que se olha a
  // regra em si, antes de saber quem foi que errou.
  const consolidado = useMemo(() => {
    if (!linhas?.length) return null
    const checks = rodarChecks(linhas)
    return {
      id: '__todos',
      nome: 'Todas as empresas',
      linhas,
      checks,
      cor: piorCor(checks),
      nFora: checks.reduce((a, c) => a + c.nFora, 0),
      valorFora: checks.reduce((a, c) => a + c.valorFora, 0),
    }
  }, [linhas])

  const lista = consolidado ? [consolidado, ...templates] : []
  const template = lista.find((t) => t.id === templateId) ?? null
  const check = template?.checks.find((c) => c.id === checkId) ?? null

  function exportar() {
    if (!check?.fora.length) return
    const colunas = [
      'Empresa',
      'Tipo',
      'Conta',
      'Nome da conta',
      'Área',
      'Área ajustada',
      'Pacote',
      'Subpacote',
      'Fornecedor',
      'Centro de custo',
      'Detalhamento',
      'Por que caiu',
      'Valor (R$)',
    ].map((key) => ({ key }))
    const dados = check.fora.map((l) => ({
      Empresa: l.empresa,
      Tipo: l.tipo,
      Conta: l.conta_codigo,
      'Nome da conta': l.conta_nome,
      'Área': l.area,
      'Área ajustada': l.area_ajustada,
      Pacote: l.pacote,
      Subpacote: l.subpacote,
      Fornecedor: l.fornecedor,
      'Centro de custo': l.centro_custo_nome,
      Detalhamento: l.detalhamento || l.descricao,
      'Por que caiu': l.motivo,
      'Valor (R$)': l.valor,
    }))
    exportarExcel(`deep-dive-${check.id}`, dados, colunas)
  }

  return (
    <Layout>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Deep Dive</h1>
          <p>
            As regras de classificação escritas no Plano de Contas do template, conferidas contra o que foi lançado
            {ciclo ? ` · Ciclo ${ciclo.ano}${versao ? ` · ${versao.nome}` : ''}` : ''}
          </p>
        </div>
        <BotaoUnidade />
      </header>

      <div className="content folha">
        <div className="panel recorte">
          <div className="panel-header">
            <div>
              <h2>Recorte</h2>
              <p>Ano e versão do orçamento que vai ser conferido</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="recorte-grupos">
              <div className="recorte-bu-torre">
                <FiltroBotoes
                  label="Ano (ciclo)"
                  valor={cicloId}
                  semTodas
                  semCorte
                  opcoes={ciclos.map((c) => ({ valor: c.id, rotulo: String(c.ano) }))}
                  onChange={(v) => {
                    setCicloId(v)
                    setVersaoId('')
                  }}
                />
                {versoes.length > 1 && (
                  <FiltroBotoes
                    label="Versão"
                    valor={versao?.id ?? ''}
                    semTodas
                    opcoes={versoes.map((v) => ({ valor: v.id, rotulo: v.nome }))}
                    onChange={setVersaoId}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {carregando && <div className="empty-hint">Lendo os lançamentos…</div>}

        {!carregando && !linhas?.length && (
          <div className="empty-hint">
            Nenhum lançamento nessa versão. Importe um template em Gestão de Importação, ou escolha outra versão.
          </div>
        )}

        {!carregando && faltaMigracao && linhas?.length > 0 && (
          <div className="painel-formato">
            A lista está por empresa porque o banco ainda não sabe qual arquivo trouxe cada lançamento. Falta rodar{' '}
            {!faltaMigracao.temHistorico && <code>2026-09-22-historico-de-importacao.sql</code>}
            {!faltaMigracao.temHistorico && !faltaMigracao.temAmarracao && ' e '}
            {!faltaMigracao.temAmarracao && <code>2026-09-29-lancamento-da-importacao.sql</code>}. Depois disso, cada
            template importado aparece aqui pelo nome do arquivo, com quem subiu e a liberação — o que já está no banco
            hoje continua por empresa, porque essa amarração não existia quando foi importado.
          </div>
        )}

        {!carregando && linhas?.length > 0 && (
          <div className="dd-grid">
            <div className="panel dd-coluna">
              <div className="panel-header">
                <div>
                  <h2>Templates</h2>
                  <p>
                    {quantosArquivos
                      ? `${quantosArquivos} arquivo(s) importado(s)`
                      : `${templates.length} empresa(s) nesta versão`}
                  </p>
                </div>
              </div>
              <div className="panel-body">
                <ul className="dd-lista">
                  {lista.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        className={`dd-item${t.id === templateId ? ' ativo' : ''}`}
                        onClick={() => {
                          setTemplateId(t.id)
                          setCheckId(null)
                        }}
                      >
                        <Farol cor={t.cor} />
                        <span className="dd-item-nome">
                          {t.nome}
                          {t.detalhe && <em>{t.detalhe}</em>}
                          <em>
                            {t.nFora
                              ? `${t.nFora} linha(s) fora · ${numero(t.valorFora)} ${u.faixa}`
                              : 'nada fora das regras'}
                          </em>
                          {t.liberacao && (
                            <span className={`flag-liberacao flag-${LIBERACOES[t.liberacao]?.cor ?? 'cinza'}`}>
                              {LIBERACOES[t.liberacao]?.rotulo ?? t.liberacao}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {!template && <div className="empty-hint dd-coluna">Escolha um template para ver os checks.</div>}

            {template && (
              <div className="panel dd-coluna">
                <div className="panel-header">
                  <div>
                    <h2>{template.nome}</h2>
                    <p>
                      {template.nFora
                        ? `${template.nFora} linha(s) fora da regra · ${numero(template.valorFora)} ${u.faixa}`
                        : 'Nenhuma linha fora das regras conferidas'}
                    </p>
                  </div>
                </div>
                <div className="panel-body">
                  <ul className="dd-lista">
                    {template.checks.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className={`dd-item${c.id === checkId ? ' ativo' : ''}`}
                          onClick={() => setCheckId(c.id)}
                        >
                          <Farol cor={c.cor} />
                          <span className="dd-item-nome">
                            {c.titulo}
                            <em>{resumirCheck(c)}</em>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {check && (
              <div className="panel dd-detalhe">
                <div className="panel-header">
                  <div>
                    <h2>{check.titulo}</h2>
                    <p>{check.regra}</p>
                  </div>
                  {check.fora.length > 0 && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={exportar}>
                      Exportar linhas
                    </button>
                  )}
                </div>
                <div className="panel-body">
                  <p className="dd-fonte">{check.fonte}</p>

                  <div className="dd-numeros">
                    <div>
                      <strong>{check.nEscopo}</strong>
                      <span>linhas na regra</span>
                    </div>
                    <div>
                      <strong>{numero(check.valorEscopo)}</strong>
                      <span>{u.faixa} na regra</span>
                    </div>
                    <div className={check.nFora ? 'fora' : ''}>
                      <strong>{check.nFora}</strong>
                      <span>linhas fora</span>
                    </div>
                    <div className={check.valorFora ? 'fora' : ''}>
                      <strong>{numero(check.valorFora)}</strong>
                      <span>{u.faixa} fora</span>
                    </div>
                    {check.medida && check.medida.valor !== null && (
                      <div>
                        <strong>{umaCasa(check.medida.valor)}%</strong>
                        <span>{check.medida.rotulo}</span>
                      </div>
                    )}
                    {check.dispensadas > 0 && (
                      <div>
                        <strong>{check.dispensadas}</strong>
                        <span>dispensadas pela exceção</span>
                      </div>
                    )}
                  </div>

                  {check.nEscopo === 0 && (
                    <p className="text-muted">
                      Nenhuma linha desta regra neste template. Pode ser que a empresa não tenha esse gasto — ou que
                      ele esteja lançado numa conta que o próprio check não alcança.
                    </p>
                  )}

                  {check.nEscopo > 0 && check.nFora === 0 && <p className="text-muted">Tudo dentro da regra.</p>}

                  {check.nFora > 0 && (
                    <>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Empresa</th>
                              <th>Conta</th>
                              <th>Área</th>
                              <th>Subpacote</th>
                              <th>Fornecedor / detalhe</th>
                              <th>Por que caiu</th>
                              <th className="text-right">{u.faixa}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {check.fora.slice(0, LIMITE_TABELA).map((l) => (
                              <tr key={l.id}>
                                <td>{l.empresa}</td>
                                <td>
                                  {[l.conta_codigo, l.conta_nome].filter(Boolean).join(' · ')}
                                </td>
                                <td>{l.area_ajustada || l.area || '—'}</td>
                                <td>{l.subpacote || '—'}</td>
                                <td>
                                  {[l.fornecedor, l.detalhamento || l.descricao].filter(Boolean).join(' · ') || '—'}
                                </td>
                                <td className="dd-motivo">{l.motivo}</td>
                                <td className="text-right">{numero(l.valor)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {check.fora.length > LIMITE_TABELA && (
                        <p className="text-muted">
                          Mostrando {LIMITE_TABELA} de {check.fora.length}. Exporte para ver todas.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
