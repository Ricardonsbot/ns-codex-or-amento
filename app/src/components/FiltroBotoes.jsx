/**
 * Filtro em botões, no lugar da lista suspensa.
 *
 * A lista escondia as opções atrás de um clique e não deixava ver quantas
 * existem nem qual está ativa sem abrir. Em botões, o recorte inteiro fica à
 * vista e trocar é um clique só.
 *
 * `opcoes` são { valor, rotulo }. O valor vazio é a opção "todas", que vem
 * primeiro e é o padrão. Com `semTodas`, ela não aparece: serve para escolha
 * entre alternativas, como "agrupar por", onde "todas" não quer dizer nada.
 */
export default function FiltroBotoes({ label, valor, opcoes, onChange, rotuloTodas = 'Todas', semTodas }) {
  return (
    <div className="filtro-botoes">
      <span className="filtro-botoes-label">{label}</span>
      <div className="filtro-botoes-lista" role="group" aria-label={label}>
        {!semTodas && (
          <button
            type="button"
            className={`filtro-chip${valor === '' ? ' ativo' : ''}`}
            aria-pressed={valor === ''}
            onClick={() => onChange('')}
          >
            {rotuloTodas}
          </button>
        )}
        {opcoes.map((o) => (
          <button
            key={o.valor}
            type="button"
            className={`filtro-chip${valor === o.valor ? ' ativo' : ''}`}
            aria-pressed={valor === o.valor}
            onClick={() => onChange(o.valor)}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  )
}
