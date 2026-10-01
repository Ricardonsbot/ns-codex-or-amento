import { Fragment, useEffect, useState } from 'react'
import { historicoDisponivel, listarImportacoes, resultadoDisponivel } from '../lib/importacoesData'
import BotaoRecolher from './BotaoRecolher'
import ChecklistImportacao from './ChecklistImportacao'

/**
 * Os templates que a ferramenta recusou.
 *
 * Fica à parte dos importados de propósito: são listas com perguntas
 * diferentes. A de cima é "o que entrou e está apto a consolidar"; esta é
 * "quem tentou subir o quê e por que não entrou" — que é o que se olha
 * quando alguém diz que mandou o arquivo e ele não aparece em lugar nenhum.
 *
 * Três motivos recusam aqui: arquivo que não dá para ler, arquivo sem uma
 * linha sequer para trazer, e arquivo lido e conferido que tinha impedimento
 * (campo essencial vazio, conta fora do plano...). Template que entrou e foi
 * devolvido por gente é outra coisa, e continua na lista de cima, na coluna
 * de liberação.
 */
const quando = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

/**
 * O motivo guardado é técnico, pra quem for atrás entender exatamente o que
 * aconteceu — "Exibir detalhes" mostra ele (ou a janela de status inteira,
 * quando o registro tem conferência). Aqui, só o resumo de uma linha.
 */
function motivoCurto(motivo) {
  if (!motivo) return '—'
  if (motivo.startsWith('Itens não preenchidos')) return 'Itens não preenchidos'
  if (motivo.startsWith('Nenhuma aba pôde ser lida')) return 'Arquivo não reconhecido'
  if (motivo.startsWith('Nenhuma das três abas')) return 'Nenhum item preenchido'
  if (motivo.startsWith('Não consegui ler a planilha')) return 'Não consegui abrir o arquivo'
  return motivo.length > 40 ? `${motivo.slice(0, 40)}…` : motivo
}

const tamanhoArquivo = (b) =>
  b ? `${(b / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : ''

/** Uma recusa de mentira, para a tela poder ser vista antes da migração. */
const EXEMPLO = [
  {
    id: 'exemplo-1',
    exemplo: true,
    arquivo: 'Template Budget 2027_Full - Onisys.xlsb',
    tamanho_bytes: 5_456_773,
    criado_em: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    usuario_email: 'fpa.bu@nstech.com.br',
    recusa_motivo: 'Não consegui ler a planilha — a aba "Base Gastos" não foi encontrada',
  },
  {
    id: 'exemplo-2',
    exemplo: true,
    arquivo: 'Budget 2027 rascunho.xlsx',
    tamanho_bytes: 184_320,
    criado_em: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    usuario_email: 'analista@nstech.com.br',
    recusa_motivo: 'Nenhuma das três abas tinha linha com valor preenchido.',
  },
]

export default function TemplatesRecusados({ versao }) {
  const [registros, setRegistros] = useState(null)
  const [semRegistro, setSemRegistro] = useState(false)
  const [erro, setErro] = useState(null)
  // Id do registro com o motivo técnico revelado embaixo da linha — sem
  // conferência guardada, é só isto que "Exibir detalhes" tem pra mostrar.
  const [expandido, setExpandido] = useState(null)
  // Registro com a janela de status aberta — só os recusados por
  // impedimento têm tipos/empresas/totais pra ela ler.
  const [statusDe, setStatusDe] = useState(null)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        // Duas migrações: a tabela (2026-09-22) e a coluna que diz o que
        // aconteceu com a tentativa (2026-09-29). Faltando qualquer uma, não
        // há recusa gravada — e a tela diz isso em vez de fingir que nunca
        // ninguém errou.
        const [temTabela, temColuna] = await Promise.all([historicoDisponivel(), resultadoDisponivel()])
        if (!temTabela || !temColuna) {
          if (!cancelado) {
            setSemRegistro(true)
            setRegistros(EXEMPLO)
          }
          return
        }
        const todos = await listarImportacoes()
        if (!cancelado) {
          setRegistros(todos.filter((r) => r.resultado === 'recusado'))
          setErro(null)
        }
      } catch (err) {
        if (!cancelado) setErro(err.message)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [versao])

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-header">
        <BotaoRecolher chave="templates-recusados" rotulo="templates recusados" />
        <div>
          <h2>Templates recusados</h2>
          <p>O que a ferramenta barrou, com quem tentou subir e o motivo</p>
        </div>
        {registros?.length > 0 && !semRegistro && (
          <span className="pill despesa">{registros.length}</span>
        )}
      </div>
      <div className="panel-body">
        {semRegistro && (
          <div className="proto-banner">
            ⓘ <strong>Exemplo.</strong> O registro das recusas ainda não está disponível — faltam rodar
            supabase/migrations/2026-09-22-historico-de-importacao.sql e
            supabase/migrations/2026-09-29-lancamento-da-importacao.sql no Supabase. As linhas abaixo são fictícias,
            só para mostrar o formato; enquanto o SQL não rodar, nada do que for recusado fica registrado.
          </div>
        )}
        {erro && <div className="proto-banner">✕ Não consegui carregar as recusas: {erro}</div>}
        {!semRegistro && !erro && !registros && <div className="empty-hint">Carregando…</div>}
        {!semRegistro && registros && !registros.length && (
          <div className="empty-hint">
            Nenhum template recusado. Arquivo que a ferramenta não conseguir ler, que não trouxer nenhuma linha com
            valor, ou que tiver impedimento na conferência, aparece aqui com quem tentou.
          </div>
        )}

        {registros?.length > 0 && (
          <div className="rolagem-x">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ARQUIVO</th>
                  <th>QUANDO</th>
                  <th>QUEM TENTOU</th>
                  <th>POR QUE NÃO ENTROU</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => {
                  const temConferencia = r.tipos && Object.keys(r.tipos).length > 0
                  const aberta = expandido === r.id
                  return (
                    <Fragment key={r.id}>
                      <tr>
                        <td>
                          <strong>{r.arquivo}</strong>
                          {r.exemplo && <span className="pill" style={{ marginLeft: 6 }}>exemplo</span>}
                          <div className="detalhe-origem">{tamanhoArquivo(r.tamanho_bytes)}</div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{quando(r.criado_em)}</td>
                        <td>
                          <span className="detalhe-email">{r.usuario_email ?? r.usuario_nome ?? '—'}</span>
                        </td>
                        <td className="dd-motivo">
                          <div className="flex-row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span>{motivoCurto(r.recusa_motivo)}</span>
                            {!r.exemplo && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() =>
                                  temConferencia ? setStatusDe(r) : setExpandido(aberta ? null : r.id)
                                }
                              >
                                Exibir detalhes
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {aberta && !temConferencia && (
                        <tr>
                          <td colSpan={4} className="dd-motivo" style={{ background: 'var(--color-bg)' }}>
                            {r.recusa_motivo}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {statusDe && <ChecklistImportacao registro={statusDe} onFechar={() => setStatusDe(null)} />}
    </div>
  )
}
