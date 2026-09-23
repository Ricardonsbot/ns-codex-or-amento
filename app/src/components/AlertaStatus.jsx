import { avaliar } from '../lib/importacoesData'

/**
 * A faixa de status do template na tela de importação: as duas bolinhas
 * (essencial e ideal), o motivo, se está apto a consolidar e o que falta.
 *
 * Aparece duas vezes: na conferência, antes de gravar — é ali que dá para
 * desistir e corrigir a planilha — e depois de importar, com o resultado do
 * que entrou.
 */
export default function AlertaStatus({ registro, escopo, previa, onAbrir }) {
  const a = avaliar(registro, escopo)
  const faltando = [...a.impedimentos, ...a.pendencias]

  return (
    <div className={`alerta-status ${a.liberado ? (a.pendencias.length ? 'atencao' : 'ok') : 'bloqueado'}`}>
      <span className="alerta-status-bolinhas">
        <span className={`bolinha ${a.corEssencial}`} title="Essencial" aria-hidden="true" />
        <span className={`bolinha ${a.corIdeal}`} title="Ideal" aria-hidden="true" />
      </span>

      <div className="alerta-status-texto">
        <strong>
          {a.motivo}
          {previa ? ' — conferência' : ''}
        </strong>
        <span>
          {a.apto ? 'Apto para consolidar' : 'Não apto para consolidar'}
          {faltando.length ? ` · falta ${faltando.map((i) => i.rotulo).join(', ')}` : ' · nada pendente'}
        </span>
      </div>

      <button className="btn btn-secondary btn-sm" type="button" onClick={onAbrir}>
        Ver status
      </button>
    </div>
  )
}
