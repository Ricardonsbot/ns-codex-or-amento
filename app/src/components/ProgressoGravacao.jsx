/**
 * Tela de progresso da gravação, depois que a conferência foi confirmada.
 *
 * O ImportWizard cobre a LEITURA da planilha; esta cobre o que vem depois —
 * gravar milhares de linhas no banco leva vários segundos, e até aqui a única
 * pista era o botão escrito "Importando…", sem dizer quanto falta.
 *
 * `progresso` é { feitos, total, fase }: fase 'apagando' quando a importação
 * substitui o que já existe, 'cabecalhos' e 'mensais' nas duas etapas da
 * gravação em lote.
 */
const FASE = {
  apagando: 'Apagando os lançamentos que serão substituídos',
  cabecalhos: 'Gravando os lançamentos',
  mensais: 'Gravando os valores mês a mês',
}

export default function ProgressoGravacao({ progresso, rotulo }) {
  if (!progresso) return null
  const { feitos = 0, total = 0, fase = 'cabecalhos' } = progresso
  const pct = total ? Math.min(100, Math.round((feitos / total) * 100)) : null

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" aria-label="Gravando a importação">
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3>Importando {rotulo}</h3>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: 13 }}>{FASE[fase] ?? FASE.cabecalhos}…</p>
          <div
            className="barra-progresso"
            role="progressbar"
            aria-valuenow={pct ?? undefined}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {/* Sem total conhecido a barra fica indeterminada, varrendo de ponta a ponta. */}
            <div className={`barra-progresso-fill${pct === null ? ' indeterminada' : ''}`} style={pct === null ? undefined : { width: `${pct}%` }} />
          </div>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
            {total ? `${feitos.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} (${pct}%)` : 'Preparando…'}
            {' · '}não feche a página até terminar
          </p>
        </div>
      </div>
    </div>
  )
}
