/**
 * A conferência da importação agrupada por conta contábil.
 *
 * Um template tem milhares de linhas, e a tabela plana obrigava a percorrer
 * todas para achar as que interessam. Por conta, a mesma informação cabe em
 * algumas dezenas de linhas, e quem confere abre só as contas que importam.
 *
 * Puro de propósito: é aqui que mora a regra, e é aqui que ela é testada.
 * A tela só desenha o que esta função devolve.
 */

/**
 * As quatro situações de uma linha, da pior para a melhor. A ordem é o que
 * manda no desempate: dentro de uma conta, o problema aparece primeiro.
 */
export const SITUACOES = {
  recusada: { ordem: 0, marca: '✕', rotulo: 'recusada', grave: true },
  semConta: { ordem: 1, marca: '⚠', rotulo: 'entra sem conta', grave: false },
  apontada: { ordem: 2, marca: '⚠', rotulo: 'entra apontada', grave: false },
  ok: { ordem: 3, marca: '✓', rotulo: 'resolvida', grave: false },
}

/** Em que situação está a linha, pelo balde em que o casamento a pôs. */
export function situacaoDaLinha(p, onde) {
  if (onde === 'fora') return 'recusada'
  if (onde === 'marcadas') return 'semConta'
  if (p.avisos?.length) return 'apontada'
  return 'ok'
}

/** O template escreve o mesmo código ora com pontos, ora sem. */
const soDigitos = (v) => String(v ?? '').replace(/\D/g, '')

/**
 * A conta da linha: a que o casamento resolveu quando existe, e a que o
 * template escreveu quando não. A linha sem conta no plano não pode cair
 * num balde "outros" — é dela que a pessoa precisa para cadastrar a conta.
 *
 * A chave é o código, resolvido ou não. A linha recusada nunca chega a ter
 * conta resolvida, e sem isso a mesma conta aparecia duas vezes na lista:
 * uma com as linhas que entraram e outra com a que foi barrada.
 */
function contaDaLinha(p) {
  const codigo = p.conta?.codigo || p.contaCodigo || ''
  const nome = p.conta?.nome || p.contaRotulo || ''
  const chave = soDigitos(codigo) || nome.toUpperCase().trim() || '(sem conta)'
  return { chave, codigo, nome, noPlano: Boolean(p.conta) }
}

const zeros = () => ({ recusada: 0, semConta: 0, apontada: 0, ok: 0 })

/**
 * Agrupa a prévia por conta.
 *
 * A ordem responde "o que eu preciso olhar primeiro": conta com ofensa vem
 * antes de conta limpa, e entre iguais manda o valor — uma conta errada de
 * R$ 2 milhões pesa mais que dez de R$ 200. Dentro da conta, o mesmo: a
 * linha problemática antes da que está certa.
 */
export function agruparPorConta(previa) {
  if (!previa) return []
  const grupos = new Map()

  const juntar = (linhas, onde) => {
    for (const p of linhas ?? []) {
      const { chave, codigo, nome, noPlano } = contaDaLinha(p)
      if (!grupos.has(chave)) {
        grupos.set(chave, { chave, codigo, nome, noPlano, linhas: [], contagem: zeros(), total: 0 })
      }
      const g = grupos.get(chave)
      // Quem manda no nome do grupo é o plano de contas, quando alguma linha
      // chegou a resolver: o rótulo escrito na planilha costuma ser o
      // aproximado.
      if (p.conta && !g.noPlano) {
        g.noPlano = true
        g.codigo = p.conta.codigo
        g.nome = p.conta.nome
      }
      const situacao = situacaoDaLinha(p, onde)
      g.linhas.push({ ...p, onde, situacao })
      g.contagem[situacao] += 1
      g.total += Number(p.total ?? 0)
    }
  }

  juntar(previa.fora, 'fora')
  juntar(previa.marcadas, 'marcadas')
  juntar(previa.prontas, 'prontas')

  const lista = [...grupos.values()].map((g) => {
    g.linhas.sort((a, b) => SITUACOES[a.situacao].ordem - SITUACOES[b.situacao].ordem || (a.linha ?? 0) - (b.linha ?? 0))
    const ofensas = g.contagem.recusada + g.contagem.semConta + g.contagem.apontada
    const pior = g.linhas.length ? g.linhas[0].situacao : 'ok'
    return { ...g, ofensas, pior, quantas: g.linhas.length }
  })

  return lista.sort(
    (a, b) =>
      (b.ofensas > 0) - (a.ofensas > 0) ||
      SITUACOES[a.pior].ordem - SITUACOES[b.pior].ordem ||
      Math.abs(b.total) - Math.abs(a.total) ||
      String(a.codigo).localeCompare(String(b.codigo), 'pt-BR')
  )
}

const SEM_PACOTE = '(sem pacote)'
const SEM_SUBPACOTE = '(sem subpacote)'

/**
 * Agrupa a prévia por Pacote > Subpacote, só com quem tem algo a resolver.
 *
 * É a mesma ideia de `agruparPorConta`, mas a conta deixa de ser o que
 * importa: um arquivo de milhares de linhas certas vira ruído na tela, e
 * quem confere quer ver só o que tem pendência, organizado do jeito que o
 * pacoteiro enxerga o próprio orçamento.
 */
export function agruparPorPacoteDivergente(previa) {
  if (!previa) return []
  const pacotes = new Map()

  const juntar = (linhas, onde) => {
    for (const p of linhas ?? []) {
      const nomePacote = (p.pacote ?? '').trim() || SEM_PACOTE
      const nomeSub = (p.subpacote ?? '').trim() || SEM_SUBPACOTE
      if (!pacotes.has(nomePacote)) pacotes.set(nomePacote, { pacote: nomePacote, subpacotes: new Map(), total: 0 })
      const pac = pacotes.get(nomePacote)
      if (!pac.subpacotes.has(nomeSub)) {
        pac.subpacotes.set(nomeSub, { subpacote: nomeSub, linhas: [], contagem: zeros(), total: 0 })
      }
      const sub = pac.subpacotes.get(nomeSub)
      const situacao = situacaoDaLinha(p, onde)
      sub.linhas.push({ ...p, onde, situacao })
      sub.contagem[situacao] += 1
      sub.total += Number(p.total ?? 0)
      pac.total += Number(p.total ?? 0)
    }
  }

  juntar(previa.fora, 'fora')
  juntar(previa.marcadas, 'marcadas')
  juntar(previa.prontas, 'prontas')

  return [...pacotes.values()]
    .map((pac) => {
      const subpacotes = [...pac.subpacotes.values()]
        .map((s) => {
          s.linhas.sort(
            (a, b) => SITUACOES[a.situacao].ordem - SITUACOES[b.situacao].ordem || (a.linha ?? 0) - (b.linha ?? 0)
          )
          const ofensas = s.contagem.recusada + s.contagem.semConta + s.contagem.apontada
          const pior = s.linhas.length ? s.linhas[0].situacao : 'ok'
          return { ...s, ofensas, pior, quantas: s.linhas.length }
        })
        .filter((s) => s.ofensas > 0)
        .sort(
          (a, b) =>
            SITUACOES[a.pior].ordem - SITUACOES[b.pior].ordem ||
            Math.abs(b.total) - Math.abs(a.total) ||
            a.subpacote.localeCompare(b.subpacote, 'pt-BR')
        )
      const ofensas = subpacotes.reduce((a, s) => a + s.ofensas, 0)
      return {
        pacote: pac.pacote,
        subpacotes,
        total: pac.total,
        ofensas,
        quantas: subpacotes.reduce((a, s) => a + s.quantas, 0),
      }
    })
    .filter((pac) => pac.ofensas > 0)
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total) || a.pacote.localeCompare(b.pacote, 'pt-BR'))
}

/** O resumo da conta em texto: "2 recusadas · 3 entram apontadas". */
export function resumoDaConta(g) {
  const partes = []
  if (g.contagem.recusada) partes.push(`${g.contagem.recusada} recusada(s)`)
  if (g.contagem.semConta) partes.push(`${g.contagem.semConta} sem conta no plano`)
  if (g.contagem.apontada) partes.push(`${g.contagem.apontada} apontada(s)`)
  if (g.contagem.ok) partes.push(`${g.contagem.ok} resolvida(s)`)
  return partes.join(' · ')
}
