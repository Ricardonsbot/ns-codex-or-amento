import { useEffect, useRef } from 'react'

const ROTULO_TIPO = { receita: 'Receita', despesa: 'Despesa (Custos)', capex: 'Capex' }
const ORDEM_TIPOS = ['receita', 'despesa', 'capex']

/** Ícone de cada estado de etapa — carregando gira, os demais são estáticos. */
function Marcador({ estado }) {
  if (estado === 'carregando') return <span className="etapa-marcador etapa-carregando" aria-hidden="true" />
  if (estado === 'ok') return <span className="etapa-marcador etapa-ok" aria-hidden="true">✓</span>
  if (estado === 'alerta') return <span className="etapa-marcador etapa-alerta" aria-hidden="true">!</span>
  if (estado === 'erro') return <span className="etapa-marcador etapa-erro" aria-hidden="true">✕</span>
  return <span className="etapa-marcador etapa-pendente" aria-hidden="true" />
}

function Etapa({ numero, titulo, estado, detalhe }) {
  return (
    <li className={`etapa-importacao linha-${estado}`}>
      <Marcador estado={estado} />
      <div>
        <div className="etapa-titulo">
          <strong>Etapa {numero}</strong> — {titulo}
        </div>
        {detalhe && <div className="etapa-detalhe">{detalhe}</div>}
      </div>
    </li>
  )
}

/**
 * Status de uma aba do template (Receita/Despesa/Capex), a partir do que
 * `checarEstrutura` devolveu. `null` enquanto a checagem ainda não chegou.
 */
function statusAba(info) {
  if (!info) return { estado: 'carregando', detalhe: 'localizando a aba, validando colunas…' }
  if (!info.encontrada) return { estado: 'erro', detalhe: `aba "${info.aba}" não encontrada no arquivo` }
  if (info.faltando.length) {
    return {
      estado: 'alerta',
      detalhe: `aba "${info.aba}" localizada, mas faltam as colunas: ${info.faltando.join(', ')}`,
    }
  }
  return {
    estado: 'ok',
    detalhe: info.usandoAlternativa
      ? `colunas ok — lida da aba "${info.aba}"`
      : `aba "${info.aba}" localizada, colunas ok`,
  }
}

/**
 * Assistente de importação, em etapas: confere as três abas do Template
 * Budget (Receita, Despesa, Capex) — inclusive das que não são o tipo desta
 * tela, porque um cabeçalho quebrado numa delas costuma ser sinal de que o
 * arquivo é o template errado — e só depois lê linha a linha a aba do tipo
 * atual.
 *
 * Existe porque a leitura pesada podia levar até 45s sem nenhum sinal do que
 * estava acontecendo, e quando faltava uma coluna a única pista vinha num
 * toast que sumia sozinho — quem importa não tinha como saber qual coluna
 * faltou nem em qual aba.
 */
export default function ImportWizard({ aberto, arquivo, tipo, estrutura, lendo, segundos, erro, onFechar }) {
  const primeiroFoco = useRef(null)
  useEffect(() => {
    if (aberto) primeiroFoco.current?.focus()
  }, [aberto])

  if (!aberto) return null

  const etapaLeitura = erro
    ? { estado: 'erro', detalhe: erro }
    : lendo || !estrutura
    ? { estado: 'carregando', detalhe: `lendo linha a linha… ${segundos}s` }
    : { estado: 'ok', detalhe: 'concluída' }

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" aria-label="Importando template">
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3>Importando template</h3>
          <button ref={primeiroFoco} className="modal-close" type="button" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-body">
          <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
            {arquivo} — conferindo a estrutura das três abas antes de importar{' '}
            {ROTULO_TIPO[tipo]?.toLowerCase()}.
          </p>

          <ol className="lista-etapas">
            {ORDEM_TIPOS.map((t, i) => (
              <Etapa
                key={t}
                numero={i + 1}
                titulo={`${ROTULO_TIPO[t]}${t === tipo ? ' — esta importação' : ''}`}
                {...statusAba(estrutura?.[t])}
              />
            ))}
            <Etapa
              numero={ORDEM_TIPOS.length + 1}
              titulo={`Lendo os lançamentos de ${ROTULO_TIPO[tipo]?.toLowerCase()}`}
              {...etapaLeitura}
            />
          </ol>

          <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
            A leitura roda em segundo plano — pode fechar esta janela e continuar usando a tela enquanto termina.
          </p>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
