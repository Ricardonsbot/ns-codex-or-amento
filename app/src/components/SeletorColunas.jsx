import { useMemo, useState } from 'react'

/**
 * Escolha das colunas antes de exportar.
 *
 * Fica no caminho compartilhado de exportação de propósito: quem pediu quer a
 * opção em qualquer arquivo do budget, e cada tela ter a sua própria caixa de
 * seleção seria seis lugares para divergir.
 *
 * Duas decisões que valem explicação:
 *
 * A escolha é lembrada por arquivo, no navegador. Quem exporta o mesmo recorte
 * toda semana não deveria remarcar as mesmas doze caixas toda semana — e como
 * é preferência de tela, e não dado do orçamento, fica no localStorage e não no
 * banco. Se o conjunto de colunas mudar, o que foi salvo é filtrado contra as
 * colunas atuais, então coluna removida não reaparece nem quebra.
 *
 * Coluna marcada como `obrigatorio` não pode ser desmarcada. São as que a
 * importação usa para achar a linha: exportar sem elas geraria um arquivo que
 * a própria ferramenta não consegue ler de volta, e o erro só apareceria na
 * hora de reimportar.
 */
const chaveSalva = (nomeArquivo) => `colunas-exportacao:${nomeArquivo}`

/**
 * A escolha inicial: a salva, se houver, filtrada contra as colunas que existem
 * hoje, e sempre com as obrigatórias dentro.
 *
 * Roda na inicialização do estado, e não num efeito. Num efeito a caixa abriria
 * com tudo marcado e corrigiria depois — um piscar —, e o componente só daria
 * para testar com DOM e temporização de efeito. Assim o primeiro render já sai
 * certo. Quem chama monta a caixa só quando ela abre, então reabrir relê.
 */
function escolhaInicial(nomeArquivo, colunas, obrigatorias) {
  const todas = colunas.map((c) => c.key)
  let inicial = todas
  try {
    const salvo = JSON.parse(globalThis.localStorage?.getItem(chaveSalva(nomeArquivo)) ?? 'null')
    if (Array.isArray(salvo) && salvo.length) {
      const validas = salvo.filter((k) => todas.includes(k))
      if (validas.length) inicial = validas
    }
  } catch {
    // localStorage bloqueado ou conteúdo corrompido: começa com todas.
  }
  return new Set([...inicial, ...obrigatorias])
}

/**
 * Colunas com `grupo` saem em blocos, cada um com o seu marcar/desmarcar. É o
 * que deixa uma exportação de 70 colunas — três blocos de doze meses — ser
 * escolhida em três cliques em vez de trinta e seis.
 */
function agrupar(colunas) {
  const grupos = []
  for (const c of colunas) {
    const nome = c.grupo ?? ''
    let g = grupos.find((x) => x.nome === nome)
    if (!g) grupos.push((g = { nome, colunas: [] }))
    g.colunas.push(c)
  }
  return grupos
}

/**
 * `chavePreferencia` é onde a escolha fica lembrada; sem ela, vale o nome do
 * arquivo. Serve para quando o nome muda com o recorte — Resultado_PL_BRK e
 * Resultado_PL_Onisys — e a escolha deve ser a mesma.
 */
export default function SeletorColunas({ nomeArquivo, chavePreferencia, colunas, onCancelar, onConfirmar }) {
  const chave = chavePreferencia ?? nomeArquivo
  const obrigatorias = useMemo(
    () => colunas.filter((c) => c.obrigatorio).map((c) => c.key),
    [colunas]
  )

  const [marcadas, setMarcadas] = useState(() => escolhaInicial(chave, colunas, obrigatorias))

  const alternar = (key) => {
    if (obrigatorias.includes(key)) return
    setMarcadas((atual) => {
      const novo = new Set(atual)
      if (novo.has(key)) novo.delete(key)
      else novo.add(key)
      return novo
    })
  }

  const alternarGrupo = (grupo) => {
    const livres = grupo.colunas.map((c) => c.key).filter((k) => !obrigatorias.includes(k))
    setMarcadas((atual) => {
      const novo = new Set(atual)
      const todasMarcadas = livres.every((k) => novo.has(k))
      for (const k of livres) {
        if (todasMarcadas) novo.delete(k)
        else novo.add(k)
      }
      return novo
    })
  }

  const grupos = agrupar(colunas)
  const comGrupos = grupos.some((g) => g.nome)

  const item = (c) => {
    const fixa = obrigatorias.includes(c.key)
    return (
      <li key={c.key}>
        <label className={fixa ? 'fixa' : undefined}>
          <input
            type="checkbox"
            checked={marcadas.has(c.key)}
            disabled={fixa}
            onChange={() => alternar(c.key)}
          />
          <span>{c.label ?? c.key}</span>
          {fixa && <span className="seletor-colunas-nota">sempre incluída</span>}
        </label>
      </li>
    )
  }

  const confirmar = () => {
    const escolhidas = colunas.filter((c) => marcadas.has(c.key))
    try {
      globalThis.localStorage?.setItem(chaveSalva(chave), JSON.stringify(escolhidas.map((c) => c.key)))
    } catch {
      // Não poder lembrar a escolha não é motivo para não exportar.
    }
    onConfirmar(escolhidas)
  }

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" aria-label="Colunas da exportação">
      <div className="modal">
        <div className="modal-header">
          <h3>Colunas da exportação</h3>
          <button className="modal-close" type="button" onClick={onCancelar} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="seletor-colunas-topo">
            <span>
              {marcadas.size} de {colunas.length} coluna(s)
            </span>
            <div className="flex-row" style={{ gap: 6 }}>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={() => setMarcadas(new Set(colunas.map((c) => c.key)))}
              >
                Todas
              </button>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={() => setMarcadas(new Set(obrigatorias))}
              >
                Nenhuma
              </button>
            </div>
          </div>

          {comGrupos ? (
            <div className="seletor-colunas-grupos">
              {grupos.map((g) => {
                const marcadasNoGrupo = g.colunas.filter((c) => marcadas.has(c.key)).length
                return (
                  <section key={g.nome || '—'} className="seletor-colunas-grupo">
                    <header>
                      <strong>{g.nome || 'Outras'}</strong>
                      <span>
                        {marcadasNoGrupo} de {g.colunas.length}
                      </span>
                      {g.colunas.some((c) => !obrigatorias.includes(c.key)) && (
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => alternarGrupo(g)}>
                          {g.colunas.every((c) => marcadas.has(c.key)) ? 'Desmarcar' : 'Marcar'} grupo
                        </button>
                      )}
                    </header>
                    <ul className="seletor-colunas">{g.colunas.map(item)}</ul>
                  </section>
                )
              })}
            </div>
          ) : (
            <ul className="seletor-colunas">{colunas.map(item)}</ul>
          )}

          {obrigatorias.length > 0 && (
            <p className="nota-tabela">
              As colunas marcadas como sempre incluídas são as que a importação usa para reconhecer a linha. Sem
              elas o arquivo sai, mas não volta.
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={onCancelar}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="button" onClick={confirmar} disabled={!marcadas.size}>
            ⭳ Exportar {marcadas.size} coluna(s)
          </button>
        </div>
      </div>
    </div>
  )
}
