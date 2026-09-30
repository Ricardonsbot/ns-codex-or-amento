/**
 * O que a conferência conta como ofensa, e quanto de cada uma o upload
 * trouxe.
 *
 * É a lista das ofensas em si, não um resumo por módulo: o arquivo é um só,
 * e quem confere quer saber "o que há de errado neste template", não "o que
 * há de errado na aba de despesa" — para isso existe o card de cada módulo,
 * logo abaixo, e a conferência por conta dentro dele.
 *
 * Puro de propósito, para ser testado sem tela.
 */

/** Quanto vale um conjunto de linhas, em módulo. */
const valorDe = (linhas) => linhas.reduce((a, p) => a + Math.abs(Number(p.total) || 0), 0)

/**
 * As quatro ofensas, das que barram para as que só apontam.
 *
 * `achar` recebe a prévia de um módulo e devolve as linhas ofendidas. Quem
 * some da lista não é a ofensa: é o grupo vazio — o sumário mostra o que há
 * para resolver, não um inventário do que poderia dar errado.
 */
export const OFENSAS = [
  {
    id: 'texto',
    grave: true,
    titulo: 'Texto onde era para ter número',
    detalhe: 'não entram — ninguém adivinha quanto vale uma frase, e entrar como zero seria pior',
    achar: (p) => p.fora.filter((f) => f.naoNumericos?.length),
  },
  {
    id: 'empresa',
    grave: true,
    titulo: 'Empresa fora do cadastro',
    detalhe: 'não entram — sem empresa não há BU, e a BU é obrigatória no lançamento',
    achar: (p) => p.fora.filter((f) => !f.naoNumericos?.length),
  },
  {
    id: 'conta',
    grave: false,
    titulo: 'Conta fora do plano',
    detalhe:
      'entram sem conta, marcadas nas observações — o valor não fica de fora, mas só volta a ser editável na grade quando a conta existir',
    achar: (p) => p.marcadas,
  },
  {
    id: 'sinal',
    grave: false,
    titulo: 'Sinal invertido',
    detalhe:
      'entram como estão — no template o valor veio positivo, e assim ele reduz a despesa no P&L; confira se é crédito ou digitação',
    achar: (p) => p.prontas.filter((x) => x.avisos?.length),
  },
]

/**
 * O sumário do upload inteiro.
 *
 * `entradas` são { tipo, rotulo, previa } — uma por módulo conferido. Cada
 * ofensa sai com o total e a abertura por módulo, que é o que diz onde ir
 * corrigir.
 */
export function sumarioDeOfensas(entradas) {
  const conferidas = (entradas ?? []).filter((e) => e?.previa)
  const lidas = conferidas.reduce(
    (a, e) => a + e.previa.prontas.length + e.previa.marcadas.length + e.previa.fora.length,
    0
  )

  const ofensas = OFENSAS.map((o) => {
    const porModulo = conferidas
      .map((e) => ({ rotulo: e.rotulo, linhas: o.achar(e.previa) }))
      .filter((x) => x.linhas.length)
    return {
      id: o.id,
      grave: o.grave,
      titulo: o.titulo,
      detalhe: o.detalhe,
      linhas: porModulo.reduce((a, x) => a + x.linhas.length, 0),
      valor: porModulo.reduce((a, x) => a + valorDe(x.linhas), 0),
      porModulo: porModulo.map((x) => ({ rotulo: x.rotulo, linhas: x.linhas.length })),
    }
  }).filter((o) => o.linhas > 0)

  return {
    ofensas,
    lidas,
    modulos: conferidas.length,
    ofendidas: ofensas.reduce((a, o) => a + o.linhas, 0),
  }
}
