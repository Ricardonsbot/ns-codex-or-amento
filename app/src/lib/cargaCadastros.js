import { supabase } from './supabaseClient'
import { ehMarcador } from './lerMapaFornecedores'

/**
 * Carga dos cadastros a partir do "Mapa Fornecedores" do template.
 *
 * A regra é uma só: **só acrescenta**. Nada do que já está no banco é apagado
 * ou sobrescrito, porque o cadastro da ferramenta pode ter sido corrigido à
 * mão depois, e o mapa do template não é mais confiável que a correção. A
 * única exceção é preencher campo VAZIO de fornecedor que já existe — grupo e
 * CNPJ —, que é ganhar informação sem perder nenhuma.
 *
 * Os marcadores do mapa ("Refinar", "Cadastrar") ficam de fora por padrão:
 * são pendência de classificação, não cadastro.
 */

const LOTE = 500

const limpo = (v) => String(v ?? '').trim()
const chave = (v) => limpo(v).toLocaleLowerCase('pt-BR')

/** Insere em lotes; devolve quantos entraram. */
async function inserir(tabela, registros, aoProgresso) {
  let feitos = 0
  for (let i = 0; i < registros.length; i += LOTE) {
    const fatia = registros.slice(i, i + LOTE)
    const { error } = await supabase.from(tabela).insert(fatia)
    if (error) throw new Error(`${tabela}: ${error.message}`)
    feitos += fatia.length
    aoProgresso?.(feitos, registros.length, tabela)
  }
  return feitos
}

/**
 * O que cada tabela já tem. `null` quando a tabela não existe — a migração
 * ainda não rodou, e a tela precisa dizer isso em vez de tentar gravar.
 */
async function existentes() {
  const [pac, sub, gru, forn] = await Promise.all([
    supabase.from('pacote').select('nome'),
    supabase.from('subpacote').select('pacote, nome'),
    supabase.from('fornecedor_grupo').select('nome'),
    supabase.from('fornecedor').select('id, nome, grupo, documento'),
  ])
  // A tabela fornecedor é antiga; a coluna `grupo` veio na migração pendente.
  // Sem ela o select inteiro falha, e seria um engano concluir que não dá
  // para cadastrar fornecedor — dá, só não dá para gravar o grupo.
  const semColunaGrupo = Boolean(forn.error)
  const forn2 = semColunaGrupo ? await supabase.from('fornecedor').select('id, nome, documento') : forn
  return {
    semColunaGrupo: semColunaGrupo && !forn2.error,
    pacote: pac.error ? null : (pac.data ?? []).map((x) => x.nome),
    subpacote: sub.error ? null : sub.data ?? [],
    grupo: gru.error ? null : (gru.data ?? []).map((x) => x.nome),
    // O fornecedor vem inteiro: é por ele que se sabe o que dá para completar.
    fornecedor: forn2.error ? null : forn2.data ?? [],
  }
}

/**
 * O que a carga faria, sem gravar nada: quantos entram, quantos já existem e
 * quantos fornecedores só ganhariam grupo ou CNPJ.
 */
export async function planejarCarga(lido, { incluirMarcadores = false } = {}) {
  const tem = await existentes()
  const passa = (nome) => incluirMarcadores || !ehMarcador(nome)

  const pacotes = lido.pacotes.filter(passa)
  const grupos = lido.grupos.filter(passa)
  const subpacotes = lido.subpacotes.filter((s) => passa(s.pacote))
  const fornecedores = lido.fornecedores

  const novosPacote = tem.pacote === null ? [] : pacotes.filter((p) => !tem.pacote.some((x) => chave(x) === chave(p)))
  const novosGrupo = tem.grupo === null ? [] : grupos.filter((g) => !tem.grupo.some((x) => chave(x) === chave(g)))
  const jaSub = new Set((tem.subpacote ?? []).map((s) => `${chave(s.pacote)}\u0000${chave(s.nome)}`))
  const novosSub = tem.subpacote === null ? [] : subpacotes.filter((s) => !jaSub.has(`${chave(s.pacote)}\u0000${chave(s.nome)}`))

  const porNome = new Map((tem.fornecedor ?? []).map((f) => [chave(f.nome), f]))
  const novosForn = []
  const completar = []
  for (const f of fornecedores) {
    const atual = porNome.get(chave(f.nome))
    if (!atual) {
      novosForn.push(f)
      continue
    }
    const patch = {}
    if (!tem.semColunaGrupo && f.grupo && !ehMarcador(f.grupo) && !limpo(atual.grupo)) patch.grupo = f.grupo
    if (f.documento && !limpo(atual.documento)) patch.documento = f.documento
    if (Object.keys(patch).length) completar.push({ id: atual.id, nome: atual.nome, patch })
  }

  return {
    // null em qualquer um deles = tabela inexistente, falta rodar a migração.
    disponivel: {
      pacote: tem.pacote !== null,
      subpacote: tem.subpacote !== null,
      grupo: tem.grupo !== null,
      fornecedor: tem.fornecedor !== null,
    },
    pacote: { novos: novosPacote, jaExistem: pacotes.length - novosPacote.length },
    subpacote: { novos: novosSub, jaExistem: subpacotes.length - novosSub.length },
    grupo: { novos: novosGrupo, jaExistem: grupos.length - novosGrupo.length },
    fornecedor: {
      novos: novosForn,
      jaExistem: fornecedores.length - novosForn.length,
      completar,
      semColunaGrupo: Boolean(tem.semColunaGrupo),
    },
    marcadoresFora: incluirMarcadores
      ? []
      : [...new Set([...lido.pacotes, ...lido.grupos].filter(ehMarcador))],
  }
}

/**
 * Grava o que o plano apontou como novo. `selecao` liga cada tabela à parte —
 * carregar 4 mil fornecedores é outra decisão que carregar 9 pacotes.
 */
export async function executarCarga(plano, selecao, aoProgresso) {
  const feito = { pacote: 0, subpacote: 0, grupo: 0, fornecedor: 0, completados: 0 }

  if (selecao.pacote && plano.pacote.novos.length) {
    feito.pacote = await inserir('pacote', plano.pacote.novos.map((nome) => ({ nome })), aoProgresso)
  }
  if (selecao.subpacote && plano.subpacote.novos.length) {
    feito.subpacote = await inserir(
      'subpacote',
      plano.subpacote.novos.map((s) => ({ pacote: s.pacote, nome: s.nome })),
      aoProgresso
    )
  }
  if (selecao.grupo && plano.grupo.novos.length) {
    feito.grupo = await inserir('fornecedor_grupo', plano.grupo.novos.map((nome) => ({ nome })), aoProgresso)
  }
  if (selecao.fornecedor) {
    if (plano.fornecedor.novos.length) {
      feito.fornecedor = await inserir(
        'fornecedor',
        plano.fornecedor.novos.map((f) => ({
          nome: f.nome,
          documento: f.documento || null,
          // Marcador não é grupo: entra vazio, para o fornecedor aparecer como
          // "sem grupo" em vez de agrupado em "Refinar".
          ...(plano.fornecedor.semColunaGrupo
            ? {}
            : { grupo: f.grupo && !ehMarcador(f.grupo) ? f.grupo : null }),
        })),
        aoProgresso
      )
    }
    // Completar é um update por fornecedor: são poucos, e cada um só recebe o
    // campo que estava vazio.
    for (const c of plano.fornecedor.completar) {
      const { error } = await supabase.from('fornecedor').update(c.patch).eq('id', c.id)
      if (error) throw new Error(`fornecedor ${c.nome}: ${error.message}`)
      feito.completados += 1
      aoProgresso?.(feito.completados, plano.fornecedor.completar.length, 'completando')
    }
  }
  return feito
}
