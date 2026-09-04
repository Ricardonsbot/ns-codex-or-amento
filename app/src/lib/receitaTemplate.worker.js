import { lerPlanilha } from './lerTemplateReceita'

// O parse do Template Budget leva dezenas de segundos. Rodar aqui mantém a tela
// respondendo enquanto isso.
self.onmessage = (e) => {
  try {
    self.postMessage({ linhas: lerPlanilha(e.data.arrayBuffer) })
  } catch (err) {
    self.postMessage({ erro: err.message })
  }
}
