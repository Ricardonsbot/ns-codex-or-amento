import { lerPlanilha } from './lerTemplateOrcamento'

// O parse do Template Budget leva dezenas de segundos. Rodar aqui mantém a tela
// respondendo enquanto isso.
self.onmessage = (e) => {
  try {
    self.postMessage({ resultado: lerPlanilha(e.data.arrayBuffer, e.data.tipo) })
  } catch (err) {
    self.postMessage({ erro: err.message })
  }
}
