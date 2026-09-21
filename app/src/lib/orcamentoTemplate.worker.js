import { lerPlanilha, lerTodosOsTipos, checarEstrutura } from './lerTemplateOrcamento'

// O parse do Template Budget leva dezenas de segundos. Rodar aqui mantém a tela
// respondendo enquanto isso.
//
// A checagem de estrutura roda primeiro e manda uma mensagem à parte: é rápida
// (só o cabeçalho das três abas) e é o que alimenta o assistente de importação
// etapa por etapa, antes do parse pesado.
//
// `tipo` pede um tipo só (lerPlanilha, o caminho de cada tela de lançamento);
// `todos: true` pede os três de uma vez (lerTodosOsTipos, a Gestão de
// Importação) — mais barato que três chamadas com `tipo` porque Despesa e
// Capex costumam ler a mesma aba, e a leitura pesada só roda uma vez para ela.
self.onmessage = (e) => {
  const { arrayBuffer, tipo, todos } = e.data
  try {
    self.postMessage({ etapa: 'estrutura', estrutura: checarEstrutura(arrayBuffer) })
    self.postMessage({
      etapa: 'concluido',
      resultado: todos ? lerTodosOsTipos(arrayBuffer) : lerPlanilha(arrayBuffer, tipo),
    })
  } catch (err) {
    self.postMessage({ etapa: 'erro', erro: err.message })
  }
}
