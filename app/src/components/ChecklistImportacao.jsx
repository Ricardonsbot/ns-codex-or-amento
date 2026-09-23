import { checklist, flagDo } from '../lib/importacoesData'

const CORES = { verde: 'Tudo certo', amarelo: 'Passou, mas confira', vermelho: 'Tem pendência' }

/**
 * O checklist do template: os itens vermelhos (o número sai errado) e os
 * amarelos (entra, mas alguém precisa olhar). Aparece logo depois de importar
 * e também dentro da linha aberta do histórico.
 */
export default function ChecklistImportacao({ registro, compacto, escopo }) {
  const itens = checklist(registro, escopo)
  const flag = flagDo(registro, escopo)
  const pendentes = itens.filter((i) => !i.ok)
  const lista = compacto ? itens : [...pendentes, ...itens.filter((i) => i.ok)]

  return (
    <div className={`checklist-importacao${compacto ? ' compacto' : ''}`}>
      {!compacto && (
        <div className="checklist-cabecalho">
          <span className={`flag-template flag-${flag}`}>● {CORES[flag]}</span>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {pendentes.length
              ? `${pendentes.length} de ${itens.length} itens pedem atenção`
              : `${itens.length} itens conferidos`}
          </span>
        </div>
      )}
      <ul className="lista-checklist">
        {lista.map((i) => (
          <li key={i.chave} className={i.ok ? 'ok' : `pendente nivel-${i.nivel}`}>
            <span aria-hidden="true">{i.ok ? '✓' : i.nivel === 'vermelho' ? '✕' : '!'}</span>
            <div>
              <strong>{i.rotulo}</strong>
              <span> — {i.detalhe}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
