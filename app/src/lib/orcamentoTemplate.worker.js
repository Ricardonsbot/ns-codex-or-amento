import { lerPlanilha, checarEstrutura } from './lerTemplateOrcamento'

// O parse do Template Budget leva dezenas de segundos. Rodar aqui mantém a tela
// respondendo enquanto isso.
//
// A checagem de estrutura roda primeiro e manda uma mensagem à parte: é rápida
// (só o cabeçalho das três abas) e é o que alimenta o assistente de importação
// etapa por etapa, antes do parse pesado da aba pedida.
self.onmessage = (e) => {
  const { arrayBuffer, tipo } = e.data
  try {
    self.postMessage({ etapa: 'estrutura', estrutura: checarEstrutura(arrayBuffer) })
    self.postMessage({ etapa: 'concluido', resultado: lerPlanilha(arrayBuffer, tipo) })
  } catch (err) {
    self.postMessage({ etapa: 'erro', erro: err.message })
  }
}
