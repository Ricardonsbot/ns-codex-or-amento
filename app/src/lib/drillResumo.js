import { classificar, PL_CONTABIL } from './demonstrativo'

/**
 * A árvore do drill-down de Revenue, Expenses e Capex: da linha do P&L até o
 * lançamento, um nível por dimensão do template.
 *
 * O primeiro nível é a linha do P&L como o Resultado a calcula (o mesmo
 * `classificar`), não a Linha P&L escrita na conta: no gasto quem decide a
 * linha é a área, e abrir por outra regra daria um "(-) G&A" aqui diferente
 * do de lá. Os níveis de baixo seguem a ordem em que o template agrupa cada
 * aba. A folha é o lançamento — o número exatamente como foi gravado.
 *
 * Módulo puro, sem Supabase: dá para conferir a soma no Node.
 */

const vazio = (rotulo) => (v) => (v === null || v === undefined || String(v).trim() === '' ? rotulo : String(v).trim())

const conta = (l) => (l.conta ? `${l.conta.codigo} — ${l.conta.nome}` : 'Sem conta')

/** As dimensões abaixo da linha do P&L, por módulo. */
export const NIVEIS = {
  receita: [
    { rotulo: 'Conta', valor: conta },
    { rotulo: 'Produto sintético', valor: (l) => vazio('Sem produto')(l.produto_sintetico) },
    { rotulo: 'Produto analítico', valor: (l) => vazio('Sem produto analítico')(l.produto_analitico) },
    { rotulo: 'Cliente', valor: (l) => vazio('Sem cliente')(l.cliente) },
  ],
  despesa: [
    { rotulo: 'Pacote', valor: (l) => vazio('Sem pacote')(l.pacote) },
    { rotulo: 'Subpacote', valor: (l) => vazio('Sem subpacote')(l.subpacote) },
    { rotulo: 'Conta', valor: conta },
    { rotulo: 'Centro de custo', valor: (l) => vazio('Sem centro de custo')(l.centro_custo_nome) },
  ],
  capex: [
    { rotulo: 'Pacote', valor: (l) => vazio('Sem pacote')(l.pacote) },
    { rotulo: 'Subpacote', valor: (l) => vazio('Sem subpacote')(l.subpacote) },
    { rotulo: 'Conta', valor: conta },
    { rotulo: 'Item', valor: (l) => vazio('Sem item')(l.item) },
  ],
}

const ORDEM_PL = new Map(PL_CONTABIL.map((p, i) => [p.s, i]))
const ROTULO_PL = new Map(PL_CONTABIL.map((p) => [p.s, p.rotulo]))

/** A linha do P&L do lançamento: rótulo e posição na ordem da Master. */
export function linhaDoPl(l) {
  const k = classificar(l)
  if (!k) return { chave: 'semConta', rotulo: 'Sem conta — fora do P&L', ordem: 999 }
  if (k.startsWith('capex:')) return { chave: 'capex', rotulo: ROTULO_PL.get('capex'), ordem: ORDEM_PL.get('capex') }
  if (k.startsWith('fora:')) return { chave: k, rotulo: k.slice(5), ordem: 998 }
  return { chave: k, rotulo: ROTULO_PL.get(k) ?? k, ordem: ORDEM_PL.get(k) ?? 997 }
}

/** O que identifica o lançamento na folha, além da empresa. */
function detalhe(l, tipo) {
  if (tipo === 'receita') return l.sku || l.cnpj || l.tipo_receita
  if (tipo === 'capex') return l.detalhamento || (l.quantidade ? `${l.quantidade} un.` : null)
  return l.detalhamento || l.auxiliar_conta || l.subconta
}

const soma = (a) => a.reduce((x, y) => x + y, 0)

function novoNo(chave, rotulo, nivel, dimensao) {
  return { chave, rotulo, nivel, dimensao, valores: Array(12).fill(0), lancamentos: 0, filhos: new Map(), folhas: [] }
}

/**
 * Monta a árvore. `linhas` vêm com `valores` (12 meses) e as colunas do
 * lançamento; `nomeEmpresa(id)` dá o nome para a folha.
 *
 * Devolve a lista de nós de primeiro nível, cada um com `filhos` (lista) e,
 * no último nível, `folhas` (os lançamentos). Os filhos saem do maior para o
 * menor em valor absoluto — é o que se procura ao abrir; o primeiro nível sai
 * na ordem do P&L.
 */
export function montarDrill(linhas, tipo, nomeEmpresa = () => null) {
  const niveis = NIVEIS[tipo] ?? NIVEIS.despesa
  const raiz = new Map()
  const ordemPl = new Map()

  for (const l of linhas) {
    const pl = linhaDoPl(l)
    ordemPl.set(pl.chave, pl.ordem)
    if (!raiz.has(pl.chave)) raiz.set(pl.chave, novoNo(pl.chave, pl.rotulo, 0, 'Linha do P&L'))
    let no = raiz.get(pl.chave)
    const caminho = [no]
    for (const [i, d] of niveis.entries()) {
      const rotulo = d.valor(l)
      const chave = `${no.chave}›${rotulo}`
      if (!no.filhos.has(chave)) no.filhos.set(chave, novoNo(chave, rotulo, i + 1, d.rotulo))
      no = no.filhos.get(chave)
      caminho.push(no)
    }
    for (const n of caminho) {
      n.lancamentos += 1
      l.valores.forEach((v, m) => (n.valores[m] += v))
    }
    no.folhas.push({
      chave: `${no.chave}›#${l.id}`,
      rotulo: [nomeEmpresa(l.empresa_id) || l.empresa_texto, detalhe(l, tipo)].filter(Boolean).join(' · ') || 'Lançamento',
      nivel: niveis.length + 1,
      dimensao: 'Lançamento',
      valores: l.valores,
      total: soma(l.valores),
    })
  }

  const fechar = (no) => {
    const filhos = [...no.filhos.values()].map(fechar).sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
    const folhas = no.folhas.sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
    return { ...no, total: soma(no.valores), filhos, folhas }
  }

  return [...raiz.values()].map(fechar).sort((a, b) => ordemPl.get(a.chave) - ordemPl.get(b.chave))
}

/** O caminho de dimensões do módulo, para o cabeçalho do quadro. */
export const caminhoDoDrill = (tipo) => ['Linha do P&L', ...(NIVEIS[tipo] ?? NIVEIS.despesa).map((n) => n.rotulo), 'Lançamento']
