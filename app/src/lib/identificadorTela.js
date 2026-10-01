import { useEffect, useState } from 'react'

/**
 * O ID de uma tela é a própria rota, maiúscula e sem barras: "/orcamento/
 * receita" vira "ORCAMENTO-RECEITA". Não é um catálogo pra manter — sai
 * direto da URL, então nunca fica desatualizado quando uma tela nova
 * aparece ou muda de caminho.
 */
export function idDaTela(pathname, search) {
  const limpo = pathname.replace(/^\/+|\/+$/g, '')
  let id = limpo ? limpo.toUpperCase().replace(/\//g, '-') : 'LOGIN'
  const modo = new URLSearchParams(search).get('modo')
  if (modo) id += `-${modo.toUpperCase()}`
  return id
}

const CHAVE = 'nsplanner.mostrarIdTela'
const EVENTO = 'nsplanner:mostrarIdTela'

function ler() {
  try {
    return window.localStorage.getItem(CHAVE) === '1'
  } catch {
    return false
  }
}

/**
 * Liga/desliga é preferência de quem olha, não dado da ferramenta: fica no
 * localStorage, não vai pro banco. Dois componentes diferentes ligam nisto
 * — o botão no Log de erros e a etiqueta que aparece na tela — por isso o
 * evento: sem ele, ligar num muda o outro só na próxima troca de tela.
 */
export function useMostrarIdTela() {
  const [ativo, setAtivo] = useState(ler)

  useEffect(() => {
    const ouvir = () => setAtivo(ler())
    window.addEventListener(EVENTO, ouvir)
    return () => window.removeEventListener(EVENTO, ouvir)
  }, [])

  function alternar() {
    const novo = !ler()
    try {
      window.localStorage.setItem(CHAVE, novo ? '1' : '0')
    } catch {
      // Sem localStorage a escolha vale só nesta aba.
    }
    setAtivo(novo)
    window.dispatchEvent(new Event(EVENTO))
  }

  return [ativo, alternar]
}

let subTelaAtual = null
const EVENTO_SUBTELA = 'nsplanner:subTela'

/**
 * Uma tela que sobe por cima da rota (um modal de várias etapas, por
 * exemplo) tem o seu próprio ID, mais específico que o da rota — "a tela
 * que sobe para importar os arquivos" é um ID à parte de GESTAO-IMPORTACAO,
 * não a mesma coisa só porque a URL não muda.
 *
 * Chame com o ID enquanto a tela estiver aberta, e com `null` (ou omita a
 * chamada) quando fechar — o `useEffect` já limpa sozinho ao desmontar.
 */
export function useSubTela(id) {
  useEffect(() => {
    if (!id) return undefined
    subTelaAtual = id
    window.dispatchEvent(new Event(EVENTO_SUBTELA))
    return () => {
      if (subTelaAtual === id) {
        subTelaAtual = null
        window.dispatchEvent(new Event(EVENTO_SUBTELA))
      }
    }
  }, [id])
}

/** O ID da sub-tela aberta agora, ou `null` se nenhuma estiver. */
export function useSubTelaAtual() {
  const [valor, setValor] = useState(subTelaAtual)

  useEffect(() => {
    const ouvir = () => setValor(subTelaAtual)
    window.addEventListener(EVENTO_SUBTELA, ouvir)
    return () => window.removeEventListener(EVENTO_SUBTELA, ouvir)
  }, [])

  return valor
}
