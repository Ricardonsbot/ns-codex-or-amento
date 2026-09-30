import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import OrcamentoEntry from './OrcamentoEntry'

// Capex era uma tela própria; virou uma aba aqui dentro porque as duas são
// "o que sai do caixa" — conferir uma sem a outra ao lado era trocar de
// menu toda hora para comparar o mesmo tipo de lançamento.
const ABAS = [
  { valor: 'despesa', rotulo: 'Expenses', titulo: 'Orçamento de Despesa', sinal: '(−)', rotuloPill: 'Expenses', corClasse: 'despesa' },
  { valor: 'capex', rotulo: 'Capex', titulo: 'Orçamento de Capex', sinal: '(−)', rotuloPill: 'Capex', corClasse: 'capex' },
]

export default function Despesa() {
  const [searchParams] = useSearchParams()
  const inicial = searchParams.get('modo') === 'capex' ? 'capex' : 'despesa'
  const [aba, setAba] = useState(inicial)
  const atual = ABAS.find((a) => a.valor === aba)

  return (
    <OrcamentoEntry
      key={aba}
      tipo={atual.valor}
      titulo={atual.titulo}
      sinal={atual.sinal}
      rotulo={atual.rotuloPill}
      corClasse={atual.corClasse}
      abas={ABAS.map((a) => ({ valor: a.valor, rotulo: a.rotulo }))}
      abaAtiva={aba}
      onMudarAba={setAba}
    />
  )
}
