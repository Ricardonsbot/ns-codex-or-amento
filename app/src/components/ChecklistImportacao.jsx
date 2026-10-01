import { useEffect, useRef } from 'react'
import { avaliar } from '../lib/importacoesData'
import { nomeDoUsuario } from '../lib/usuario'
import { useUnidade } from './UnidadeProvider'

const quando = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—')
const ROTULO_TIPO = { receita: 'Receita (Revenue)', despesa: 'Despesa (Expenses)', capex: 'Capex' }

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
export default function ChecklistImportacao({
  registro,
  escopo,
  onFechar,
  podeSubstituir,
  substituindo,
  onSubstituir,
}) {
  const { numero } = useUnidade()
  const fechar = useRef(null)
  useEffect(() => {
    fechar.current?.focus()
    const esc = (e) => e.key === 'Escape' && onFechar?.()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onFechar])

  const a = avaliar(registro, escopo)
  // Só faz sentido substituir um arquivo de verdade, já gravado, e que passou
  // na conferência — sem isso não há "o que este arquivo trouxe" para manter.
  const mostrarSubstituir =
    podeSubstituir && (escopo ?? 'arquivo') === 'arquivo' && registro?.id && !registro?.exemplo && a.apto

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" aria-label="Status do template">
      <div className="modal modal-status" style={{ maxWidth: 980 }}>
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
                    <span className="detalhe-email">
                      {registro?.usuario_nome ?? nomeDoUsuario(registro?.usuario_email) ?? '—'}
                    </span>
                  </Detalhe>
                  <Detalhe rotulo="Ciclo">
                    {[registro?.ano, registro?.versao_nome].filter(Boolean).join(' - ') || '—'}
                  </Detalhe>
                </div>
              </div>
            </div>

            <div className="status-niveis">
              <div className="status-titulo">
                Status
                <span className="status-titulo-resumo">
                  {a.impedimentos.length > 0 && `${a.impedimentos.length} impedimento(s)`}
                  {a.impedimentos.length > 0 && a.pendencias.length > 0 && ' · '}
                  {a.pendencias.length > 0 && `${a.pendencias.length} pendência(s)`}
                  {!a.impedimentos.length && !a.pendencias.length && 'nada pendente'}
                </span>
              </div>

              <div className="grade-validacao">
                {[
                  ...a.essenciais.map((i) => ({ ...i, nivel: 'essencial' })),
                  ...a.ideais.map((i) => ({ ...i, nivel: 'ideal' })),
                ].map((i) => {
                  const classe = i.ok ? 'ok' : i.nivel === 'essencial' ? 'impedimento' : 'pendencia'
                  return (
                    <div key={i.chave} className={`quadrado-validacao ${classe}`}>
                      <div className="quadrado-validacao-rotulo">
                        <span aria-hidden="true">{i.ok ? '✓' : classe === 'impedimento' ? '✕' : '!'}</span>
                        {i.rotulo}
                      </div>
                      <div className="quadrado-validacao-detalhe">{i.detalhe}</div>
                    </div>
                  )
                })}
              </div>
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
          </div>

          {mostrarSubstituir && (
            <div className="substituir-bloco">
              <div className="status-titulo">Substituir</div>
              <p>
                Apaga os lançamentos anteriores deste tipo, nesta versão, e mantém só o que este arquivo trouxe —
                não dá para desfazer.
              </p>
              <div className="flex-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {Object.keys(registro.tipos ?? {}).map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={substituindo === tipo}
                    onClick={() => onSubstituir?.(tipo)}
                  >
                    {substituindo === tipo ? 'Substituindo…' : `Substituir ${ROTULO_TIPO[tipo] ?? tipo}`}
                  </button>
                ))}
              </div>
            </div>
          )}
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
