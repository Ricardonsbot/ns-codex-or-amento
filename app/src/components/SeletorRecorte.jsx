import { useId, useMemo, useRef, useState } from 'react'

/**
 * O recorte BU → Torre → Empresa numa caixa só, de digitar.
 *
 * Substitui a fila de botões de BU, a de Torre e a caixa de Empresa: eram três
 * lugares para uma escolha só, e a Torre passava de dez botões com um "+ 7"
 * escondendo o resto. Aqui a lista é a árvore inteira, recuada por nível, e
 * digitar filtra por qualquer pedaço do caminho — "fintech" acha a torre e
 * todas as empresas dela.
 *
 * Escolher um nível preenche os de cima com o caminho da árvore — o mesmo
 * que dava clicar BU, depois Torre, depois Empresa nos botões. O Revenue
 * precisa disso: adicionar linha na grade exige a BU.
 */
const SETA = ' → '

const normalizar = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR')

function montarArvore(bus, torres, empresas, rotuloTodas) {
  const itens = [{ chave: 'todos', nivel: 0, caminho: [rotuloTodas], valor: { buId: '', torreId: '', empresaId: '' } }]
  const torreDe = new Map(torres.map((t) => [t.id, t]))
  const usadas = new Set()
  const usadasTorres = new Set()

  // `pai` é o valor do nível de cima: a empresa herda a BU e a Torre dele.
  const empresa = (e, nivel, antes, pai) => {
    usadas.add(e.id)
    itens.push({
      chave: `e-${e.id}`,
      tipo: 'empresa',
      nivel,
      caminho: [...antes, e.nome],
      valor: { ...pai, empresaId: e.id },
    })
  }
  const torre = (t, nivel, antes, buId) => {
    usadasTorres.add(t.id)
    const caminho = [...antes, t.nome]
    const valor = { buId, torreId: t.id, empresaId: '' }
    itens.push({ chave: `t-${t.id}`, nivel, caminho, valor })
    empresas.filter((e) => e.torre_id === t.id).sort(porNome).forEach((e) => empresa(e, nivel + 1, caminho, valor))
  }

  for (const b of [...bus].sort(porNome)) {
    const valor = { buId: b.id, torreId: '', empresaId: '' }
    itens.push({ chave: `b-${b.id}`, nivel: 0, caminho: [b.nome], valor })
    torres.filter((t) => t.bu_id === b.id).sort(porNome).forEach((t) => torre(t, 1, [b.nome], b.id))
    // Empresa da BU sem torre (ou com torre que não existe): fica direto na BU.
    empresas
      .filter((e) => e.bu_id === b.id && !usadas.has(e.id) && !torreDe.has(e.torre_id))
      .sort(porNome)
      .forEach((e) => empresa(e, 1, [b.nome], valor))
  }
  // Sobras de cadastro incompleto: sem elas a empresa sumia da lista.
  const vazio = { buId: '', torreId: '', empresaId: '' }
  torres.filter((t) => !usadasTorres.has(t.id)).sort(porNome).forEach((t) => torre(t, 0, [], ''))
  empresas.filter((e) => !usadas.has(e.id)).sort(porNome).forEach((e) => empresa(e, 0, [], vazio))
  return itens
}

export default function SeletorRecorte({
  bus = [],
  torres = [],
  empresas = [],
  valor,
  onChange,
  label = 'BU → Torre → Empresa',
  rotuloTodas = 'Consolidado',
}) {
  const id = useId()
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [ativo, setAtivo] = useState(0)
  const lista = useRef(null)

  const arvore = useMemo(() => montarArvore(bus, torres, empresas, rotuloTodas), [bus, torres, empresas, rotuloTodas])

  const escolhido =
    arvore.find((i) =>
      valor.empresaId
        ? i.valor.empresaId === valor.empresaId
        : valor.torreId
        ? i.valor.torreId === valor.torreId && !i.valor.empresaId
        : valor.buId
        ? i.valor.buId === valor.buId
        : i.chave === 'todos'
    ) ?? arvore[0]

  const termo = normalizar(busca.trim())
  const visiveis = termo ? arvore.filter((i) => normalizar(i.caminho.join(' ')).includes(termo)) : arvore

  function escolher(item) {
    onChange(item.valor)
    setAberto(false)
    setBusca('')
  }

  function abrir() {
    setAberto(true)
    setBusca('')
    setAtivo(Math.max(0, arvore.indexOf(escolhido)))
  }

  function teclas(e) {
    if (!aberto && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      abrir()
      e.preventDefault()
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const n = Math.min(visiveis.length - 1, Math.max(0, ativo + (e.key === 'ArrowDown' ? 1 : -1)))
      setAtivo(n)
      lista.current?.children[n]?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter' && visiveis[ativo]) {
      e.preventDefault()
      escolher(visiveis[ativo])
    } else if (e.key === 'Escape') {
      setAberto(false)
      setBusca('')
    }
  }

  return (
    <div className="filter-field seletor-recorte">
      <label htmlFor={id}>{label}</label>
      <div className="seletor-recorte-caixa">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={aberto}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          autoComplete="off"
          value={aberto ? busca : escolhido.caminho.join(SETA)}
          placeholder={escolhido.caminho.join(SETA)}
          onFocus={abrir}
          onClick={() => !aberto && abrir()}
          onBlur={() => {
            setAberto(false)
            setBusca('')
          }}
          onChange={(e) => {
            setBusca(e.target.value)
            setAtivo(0)
          }}
          onKeyDown={teclas}
        />
        <span className="seletor-recorte-seta" aria-hidden="true">▾</span>
        {aberto && (
          <ul className="seletor-recorte-lista" role="listbox" id={`${id}-lista`} ref={lista}>
            {visiveis.length === 0 && <li className="seletor-recorte-vazio">Nada com “{busca}”</li>}
            {visiveis.map((item, i) => (
              <li
                key={item.chave}
                role="option"
                aria-selected={item === escolhido}
                className={`nivel-${termo ? 0 : item.nivel}${item.tipo === 'empresa' ? ' empresa' : ''}${i === ativo ? ' ativo' : ''}${item === escolhido ? ' escolhido' : ''}`}
                // mousedown, não click: o click chega depois do blur, e o blur
                // já teria fechado a lista.
                onMouseDown={(e) => {
                  e.preventDefault()
                  escolher(item)
                }}
                onMouseEnter={() => setAtivo(i)}
              >
                {termo && item.caminho.length > 1 && (
                  <span className="seletor-recorte-antes">{item.caminho.slice(0, -1).join(SETA) + SETA}</span>
                )}
                {item.caminho[item.caminho.length - 1]}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
