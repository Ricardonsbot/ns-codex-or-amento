import { useState } from 'react'

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
 *
 * A lista é cortada por uma regra única, a mesma em todo recorte — ver
 * `quantosMostrar`. Com 60 empresas os botões viravam a maior mancha da tela e
 * puxavam a atenção para um controle em vez do número, que foi o que o FP&A
 * apontou. O que está selecionado aparece sempre, mesmo além do corte, e o
 * "+ N" / "− menos" expande e recolhe.
 */

/**
 * Quantas opções aparecem antes do "+ N", pelo total da lista.
 *
 *   até 10 ......... todas — esconder uma ou duas atrás de um clique não
 *                    economiza espaço e só esconde
 *   11 a 30 ........ 8 — uma linha de botões; o resto fica a um clique
 *   mais de 30 ..... 12 — listas longas (empresas) ganham um pouco mais,
 *                    porque o "+ N" ali esconde dezenas
 *
 * O corte nunca esconde menos de 3: com 11 opções saem 8 e o "+ 3".
 */
function quantosMostrar(total) {
  if (total <= 10) return total
  if (total <= 30) return 8
  return 12
}

export default function FiltroBotoes({ label, valor, opcoes, onChange, rotuloTodas = 'Todas', semTodas, semCorte }) {
  const [abertoTudo, setAbertoTudo] = useState(false)
  // `semCorte` é para lista de domínio fixo e curto, como os 12 meses: ali
  // esconder março atrás de um "+ 4" só atrapalha.
  const limite = semCorte ? opcoes.length : quantosMostrar(opcoes.length)
  const cortavel = opcoes.length > limite
  const visiveis =
    cortavel && !abertoTudo
      ? opcoes.slice(0, limite).concat(opcoes.slice(limite).filter((o) => o.valor === valor))
      : opcoes
  const escondidas = opcoes.length - visiveis.length

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
        {visiveis.map((o) => (
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
        {escondidas > 0 && (
          <button type="button" className="filtro-chip mais" onClick={() => setAbertoTudo(true)}>
            + {escondidas}
          </button>
        )}
        {cortavel && abertoTudo && (
          <button type="button" className="filtro-chip mais" onClick={() => setAbertoTudo(false)}>
            − menos
          </button>
        )}
      </div>
    </div>
  )
}
