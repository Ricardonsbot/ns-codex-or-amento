import { useEffect, useRef } from 'react'
import { avaliar } from '../lib/importacoesData'
import { useUnidade } from './UnidadeProvider'

const quando = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—')

/** Uma linha "Rótulo: valor" do bloco de detalhes. */
function Detalhe({ rotulo, children }) {
  return (
    <div className="detalhe-linha">
      <span>{rotulo}:</span>
      <div>{children}</div>
    </div>
  )
}

/**
 * O status de um template importado, numa janela: os detalhes do arquivo à
 * esquerda e, à direita, o que é essencial para consolidar, o que seria ideal
 * ter e o que impede a liberação. Embaixo, as medidas que o arquivo trouxe.
 *
 * Abre sozinha depois de importar e ao clicar na linha do histórico.
 */
export default function ChecklistImportacao({ registro, escopo, onFechar }) {
  const { numero, u } = useUnidade()
  const fechar = useRef(null)
  useEffect(() => {
    fechar.current?.focus()
    const esc = (e) => e.key === 'Escape' && onFechar?.()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onFechar])

  const a = avaliar(registro, escopo)

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" aria-label="Status do template">
      <div className="modal modal-status" style={{ maxWidth: 820 }}>
        <div className="modal-header">
          <h3>Status do template</h3>
          <button ref={fechar} className="modal-close" type="button" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="status-colunas">
            <div className="status-detalhes">
              <div className="status-titulo">Detalhes</div>
              <div className="detalhe-bloco">
                <span className="detalhe-icone" aria-hidden="true">🗒</span>
                <div>
                  <Detalhe rotulo="Nome">{registro?.arquivo ?? '—'}</Detalhe>
                  <Detalhe rotulo="Data Import">{quando(registro?.criado_em)}</Detalhe>
                  <Detalhe rotulo="User">
                    <span className="detalhe-email">{registro?.usuario_email ?? registro?.usuario_nome ?? '—'}</span>
                  </Detalhe>
                  <Detalhe rotulo="Ciclo">
                    {[registro?.ano, registro?.versao_nome].filter(Boolean).join(' - ') || '—'}
                  </Detalhe>
                </div>
              </div>
            </div>

            <div className="status-niveis">
              <div className="status-titulo">Status</div>

              <div className="nivel">
                <span className={`bolinha ${a.liberado ? 'verde' : 'cinza'}`} aria-hidden="true" />
                <div>
                  <strong>Essencial {a.liberado ? '(Liberado)' : '(Incompleto)'}</strong>
                  <ul className="nivel-itens">
                    {a.essenciais.map((i) => (
                      <li key={i.chave} className={i.ok ? 'ok' : 'falta'}>
                        <span aria-hidden="true">{i.ok ? '☑' : '☐'}</span> {i.rotulo}
                        <em>{i.detalhe}</em>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {a.ideais.length > 0 && (
                <div className="nivel">
                  <span className={`bolinha ${a.pendencias.length ? 'amarelo' : 'verde'}`} aria-hidden="true" />
                  <div>
                    <strong>Ideal {a.pendencias.length ? '(Pendências)' : '(Completo)'}</strong>
                    <ul className="nivel-itens">
                      {a.ideais.map((i) => (
                        <li key={i.chave} className={i.ok ? 'ok' : 'falta'}>
                          <span aria-hidden="true">{i.ok ? '☑' : '☐'}</span> {i.rotulo}
                          <em>{i.detalhe}</em>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {a.impedimentos.length > 0 && (
                <div className="nivel">
                  <span className="bolinha vermelho" aria-hidden="true" />
                  <div>
                    <strong>Impedimento (Não Liberado)</strong>
                    <ul className="nivel-itens">
                      {a.impedimentos.map((i) => (
                        <li key={i.chave} className="falta">
                          {i.rotulo}
                          <em>{i.detalhe}</em>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="status-medidas">
            {a.medidas.map((m) => (
              <div key={m.chave}>
                <div className="status-medida-rotulo">{m.rotulo}</div>
                <div className="status-medida-valor">
                  <span className={`bolinha ${m.cor}`} aria-hidden="true" />
                  {m.valor ? numero(m.valor) : '—'}
                </div>
              </div>
            ))}
            <div className="status-medidas-unidade">{u.faixa}</div>
          </div>
        </div>

        <div className="modal-footer">
          <span style={{ marginRight: 'auto', fontSize: 12.5 }}>
            Consolidação: <strong>{a.apto ? 'Apto para consolidar' : 'Não apto'}</strong>
          </span>
          <button className="btn btn-secondary" type="button" onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
