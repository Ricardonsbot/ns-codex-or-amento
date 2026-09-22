import { UNIDADES, useUnidade } from './UnidadeProvider'

/**
 * Troca a unidade dos valores da tela — R$ M ou R$ mil. A escolha é do app
 * inteiro: trocar aqui troca em todas as telas.
 */
export default function BotaoUnidade({ label = 'Unidade' }) {
  const { unidade, setUnidade } = useUnidade()
  return (
    <div className="filtro-botoes">
      {label && <span className="filtro-botoes-label">{label}</span>}
      <div className="filtro-botoes-lista" role="group" aria-label="Unidade dos valores">
        {Object.values(UNIDADES).map((u) => (
          <button
            key={u.valor}
            type="button"
            className={`filtro-chip${unidade === u.valor ? ' ativo' : ''}`}
            aria-pressed={unidade === u.valor}
            onClick={() => setUnidade(u.valor)}
          >
            {u.rotuloCurto}
          </button>
        ))}
      </div>
    </div>
  )
}
