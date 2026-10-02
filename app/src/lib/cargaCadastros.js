import { supabase } from './supabaseClient'
import { ehMarcador } from './lerCadastrosTemplate'

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

/**
 * Lê uma tabela inteira, em páginas.
 *
 * O PostgREST devolve no máximo mil linhas por requisição, e ignora um limit
 * maior. Sem paginar, a carga só enxergava as mil primeiras e concluía que o
 * resto do template era novidade: com centro de custo (quase 2 mil linhas)
 * isso significava tentar inserir de novo o que já estava lá — erro de chave
 * única no melhor caso, duplicata numa tabela sem chave única no pior.
 */
const PAGINA = 1000
async function tudo(tabela, select) {
  const linhas = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase.from(tabela).select(select).range(de, de + PAGINA - 1)
    if (error) return { error }
    linhas.push(...(data ?? []))
    if ((data?.length ?? 0) < PAGINA) return { data: linhas }
  }
}

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
  // Fornecedor e centro de custo passam de mil linhas: os dois vão paginados.
  const [pac, sub, gru, forn, cc, dir, emp, bu, torre, subTorre] = await Promise.all([
    supabase.from('pacote').select('nome'),
    supabase.from('subpacote').select('pacote, nome'),
    supabase.from('fornecedor_grupo').select('nome'),
    tudo('fornecedor', 'id, nome, grupo, documento'),
    tudo('centro_de_custo', 'id, codigo, nome, empresa, diretoria'),
    supabase.from('diretoria').select('nome'),
    supabase.from('empresa').select('id, nome, bu_id, torre_id, sub_torre_id'),
    supabase.from('bu').select('id, nome'),
    supabase.from('torre').select('id, nome, bu_id'),
    supabase.from('sub_torre').select('id, nome, torre_id'),
  ])
  // A tabela fornecedor é antiga; a coluna `grupo` veio na migração pendente.
  // Sem ela o select inteiro falha, e seria um engano concluir que não dá
  // para cadastrar fornecedor — dá, só não dá para gravar o grupo.
  const semColunaGrupo = Boolean(forn.error)
  const forn2 = semColunaGrupo ? await tudo('fornecedor', 'id, nome, documento') : forn
  // Mesma história no centro de custo: `empresa` e `diretoria` vêm da
  // migração 2026-10-01. Sem elas o select inteiro falha, e concluir daí
  // que não dá para cadastrar centro de custo seria errado — dá, só não dá
  // para gravar de que empresa e diretoria ele é.
  const semDePara = Boolean(cc.error)
  const cc2 = semDePara ? await tudo('centro_de_custo', 'id, codigo, nome') : cc
  return {
    semColunaGrupo: semColunaGrupo && !forn2.error,
    pacote: pac.error ? null : (pac.data ?? []).map((x) => x.nome),
    subpacote: sub.error ? null : sub.data ?? [],
    grupo: gru.error ? null : (gru.data ?? []).map((x) => x.nome),
    // O fornecedor vem inteiro: é por ele que se sabe o que dá para completar.
    fornecedor: forn2.error ? null : forn2.data ?? [],
    semDeParaDeCentro: semDePara && !cc2.error,
    centroCusto: cc2.error ? null : cc2.data ?? [],
    diretoria: dir.error ? null : (dir.data ?? []).map((x) => x.nome),
    empresa: emp.error ? null : emp.data ?? [],
    bu: bu.error ? null : bu.data ?? [],
    torre: torre.error ? null : torre.data ?? [],
    subTorre: subTorre.error ? null : subTorre.data ?? [],
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

  // ---- centro de custo: casa por código, que é o que a Base Gastos escreve
  //
  // Dois movimentos, não um. O código e o nome já subiam, e por isso quase
  // nada aqui é "novo": os 2 mil centros entraram na primeira carga. O que
  // falta é o de-para — de que empresa e de que diretoria cada um é —, e
  // isso só chega nos que JÁ existem, por update. Sem a segunda parte,
  // rodar a carga de novo não mudaria nada e pareceria que o de-para subiu.
  const centros = lido.centrosDeCusto ?? []
  const porCodigo = new Map((tem.centroCusto ?? []).map((c) => [chave(c.codigo), c]))
  const novosCentro = []
  const completarCentro = []
  for (const c of centros) {
    const atual = porCodigo.get(chave(c.codigo))
    if (!atual) {
      if (tem.centroCusto !== null) novosCentro.push(c)
      continue
    }
    if (tem.semDeParaDeCentro) continue
    // Só preenche o que está vazio: quem editou o cadastro à mão mandou
    // mais do que o mapa, e a carga não está aqui para desfazer isso.
    const patch = {}
    if (c.empresa && !limpo(atual.empresa)) patch.empresa = c.empresa
    if (c.diretoria && !limpo(atual.diretoria)) patch.diretoria = c.diretoria
    if (Object.keys(patch).length) completarCentro.push({ id: atual.id, codigo: atual.codigo, patch })
  }

  // ---- diretoria
  const diretorias = lido.diretorias ?? []
  const novasDiretorias =
    tem.diretoria === null ? [] : diretorias.filter((d) => !tem.diretoria.some((x) => chave(x) === chave(d)))

  // ---- empresa e a hierarquia acima dela
  //
  // A empresa pode já estar cadastrada com o nome antigo do mapa ("ATSLog
  // Jornada" virou "ATS - Jornada"): casar só pelo nome novo criaria a mesma
  // empresa duas vezes. Quem casa pelo nome antigo entra como renomeação a
  // confirmar, nunca renomeada em silêncio.
  const doMapa = lido.empresas ?? []
  const porNomeEmp = new Map((tem.empresa ?? []).map((e) => [chave(e.nome), e]))
  const novasEmpresas = []
  const renomear = []
  const completarEmpresa = []
  for (const e of doMapa) {
    const atual = porNomeEmp.get(chave(e.nome))
    if (!atual) {
      const velha = e.antes ? porNomeEmp.get(chave(e.antes)) : null
      if (velha) renomear.push({ de: velha.nome, para: e.nome })
      else novasEmpresas.push(e)
      continue
    }
    // Já existe: só interessa o que está faltando na hierarquia dela.
    const falta = []
    if (!atual.torre_id && e.torre) falta.push('torre')
    if (!atual.sub_torre_id && e.subtorre) falta.push('subtorre')
    if (falta.length) completarEmpresa.push({ id: atual.id, nome: atual.nome, mapa: e, falta })
  }
  const nomesBu = new Set((tem.bu ?? []).map((x) => chave(x.nome)))
  const nomesTorre = new Set((tem.torre ?? []).map((x) => chave(x.nome)))
  const nomesSub = new Set((tem.subTorre ?? []).map((x) => chave(x.nome)))
  const usadas = [...novasEmpresas, ...completarEmpresa.map((c) => c.mapa)]
  const novasBu = [...new Set(usadas.map((e) => e.bu).filter((x) => x && !nomesBu.has(chave(x))))]
  const novasTorre = [...new Set(usadas.map((e) => e.torre).filter((x) => x && !nomesTorre.has(chave(x))))]
  const novasSub = [...new Set(usadas.map((e) => e.subtorre).filter((x) => x && !nomesSub.has(chave(x))))]

  return {
    // null em qualquer um deles = tabela inexistente, falta rodar a migração.
    disponivel: {
      pacote: tem.pacote !== null,
      subpacote: tem.subpacote !== null,
      grupo: tem.grupo !== null,
      fornecedor: tem.fornecedor !== null,
      centroCusto: tem.centroCusto !== null,
      diretoria: tem.diretoria !== null,
      empresa: tem.empresa !== null && tem.bu !== null,
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
    centroCusto: {
      novos: novosCentro,
      jaExistem: centros.length - novosCentro.length,
      completar: completarCentro,
      semDePara: Boolean(tem.semDeParaDeCentro),
      ambiguos: lido.centrosAmbiguos ?? 0,
    },
    diretoria: { novos: novasDiretorias, jaExistem: diretorias.length - novasDiretorias.length },
    empresa: {
      novos: novasEmpresas,
      jaExistem: doMapa.length - novasEmpresas.length,
      completar: completarEmpresa,
      renomear,
      // O que a hierarquia precisa ganhar para as empresas novas caberem.
      hierarquia: { bu: novasBu, torre: novasTorre, subTorre: novasSub },
    },
    conflitosDeCentro: lido.conflitosDeCentro ?? 0,
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
  const feito = { pacote: 0, subpacote: 0, grupo: 0, fornecedor: 0, centroCusto: 0, diretoria: 0, empresa: 0, completados: 0 }

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
  if (selecao.centroCusto) {
    if (plano.centroCusto.novos.length) {
      feito.centroCusto = await inserir(
        'centro_de_custo',
        plano.centroCusto.novos.map((c) => ({
          codigo: c.codigo,
          nome: c.nome,
          // Sem as colunas, entra só o que entrava antes — a carga não pode
          // quebrar porque a migração não rodou ainda.
          ...(plano.centroCusto.semDePara ? {} : { empresa: c.empresa || null, diretoria: c.diretoria || null }),
        })),
        aoProgresso
      )
    }
    // E o de-para dos que já estavam lá, um update por centro, como no
    // fornecedor. São muitos, mas só os que têm algo a receber.
    for (const c of plano.centroCusto.completar) {
      const { error } = await supabase.from('centro_de_custo').update(c.patch).eq('id', c.id)
      if (error) throw new Error(`centro de custo ${c.codigo}: ${error.message}`)
      feito.completados += 1
      aoProgresso?.(feito.completados, plano.centroCusto.completar.length, 'completando')
    }
  }
  if (selecao.diretoria && plano.diretoria.novos.length) {
    feito.diretoria = await inserir('diretoria', plano.diretoria.novos.map((nome) => ({ nome })), aoProgresso)
  }
  if (selecao.empresa) {
    feito.empresa = await carregarEmpresas(plano, aoProgresso)
  }

  return feito
}

/**
 * Empresas e a hierarquia acima delas.
 *
 * A ordem não é escolha: `empresa.bu_id` é obrigatório e a torre depende da
 * BU, então BU, torre e sub torre entram antes, e cada uma precisa do id da
 * de cima. Por isso esta parte não é um `inserir` como as outras.
 *
 * Empresa que já existe não é tocada, exceto para preencher a torre ou a sub
 * torre que estavam vazias. Renomeação nunca acontece aqui: o plano só a
 * aponta, para alguém decidir.
 */
async function carregarEmpresas(plano, aoProgresso) {
  const { novos, completar, hierarquia } = plano.empresa
  if (!novos.length && !completar.length) return 0

  const idPorNome = async (tabela, select) => {
    const { data, error } = await supabase.from(tabela).select(select)
    if (error) throw new Error(`${tabela}: ${error.message}`)
    return new Map((data ?? []).map((x) => [chave(x.nome), x.id]))
  }

  // BU primeiro: torre depende dela, e empresa depende das duas.
  if (hierarquia.bu.length) {
    const { error } = await supabase.from('bu').insert(hierarquia.bu.map((nome) => ({ nome })))
    if (error) throw new Error(`bu: ${error.message}`)
  }
  const bus = await idPorNome('bu', 'id, nome')

  if (hierarquia.torre.length) {
    // A torre de cada nome novo sai da primeira empresa que a usa: é de lá que
    // vem a BU à qual ela pertence.
    const daTorre = new Map()
    for (const e of [...novos, ...completar.map((c) => c.mapa)]) {
      if (e.torre && !daTorre.has(chave(e.torre))) daTorre.set(chave(e.torre), e)
    }
    const registros = hierarquia.torre
      .map((nome) => {
        const e = daTorre.get(chave(nome))
        const bu_id = bus.get(chave(e?.bu))
        return bu_id ? { nome, bu_id } : null
      })
      .filter(Boolean)
    if (registros.length) {
      const { error } = await supabase.from('torre').insert(registros)
      if (error) throw new Error(`torre: ${error.message}`)
    }
  }
  const torres = await idPorNome('torre', 'id, nome')

  if (hierarquia.subTorre.length) {
    const daSub = new Map()
    for (const e of [...novos, ...completar.map((c) => c.mapa)]) {
      if (e.subtorre && !daSub.has(chave(e.subtorre))) daSub.set(chave(e.subtorre), e)
    }
    const registros = hierarquia.subTorre
      .map((nome) => {
        const e = daSub.get(chave(nome))
        const torre_id = torres.get(chave(e?.torre))
        return torre_id ? { nome, torre_id } : null
      })
      .filter(Boolean)
    if (registros.length) {
      const { error } = await supabase.from('sub_torre').insert(registros)
      if (error) throw new Error(`sub_torre: ${error.message}`)
    }
  }
  const subs = await idPorNome('sub_torre', 'id, nome')

  const ids = (e) => ({
    bu_id: bus.get(chave(e.bu)) ?? null,
    torre_id: torres.get(chave(e.torre)) ?? null,
    sub_torre_id: subs.get(chave(e.subtorre)) ?? null,
  })

  let feitos = 0
  const registros = novos.map((e) => ({ nome: e.nome, ...ids(e) })).filter((x) => x.bu_id)
  if (registros.length) {
    feitos += await inserir('empresa', registros, aoProgresso)
  }
  // Completar é um update por empresa, só nos campos que estavam vazios.
  for (const c of completar) {
    const x = ids(c.mapa)
    const patch = {}
    if (c.falta.includes('torre') && x.torre_id) patch.torre_id = x.torre_id
    if (c.falta.includes('subtorre') && x.sub_torre_id) patch.sub_torre_id = x.sub_torre_id
    if (!Object.keys(patch).length) continue
    const { error } = await supabase.from('empresa').update(patch).eq('id', c.id)
    if (error) throw new Error(`empresa ${c.nome}: ${error.message}`)
    feitos += 1
    aoProgresso?.(feitos, completar.length, 'completando empresas')
  }
  return feitos
}

