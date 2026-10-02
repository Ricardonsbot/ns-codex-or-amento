import { useUnidade } from './UnidadeProvider'

/**
 * Os cards de resumo da tela de importação (linhas, Revenue, Expenses, Capex,
 * empresas, contas), no visual de antes: moldura única com uma caixa por
 * número, tudo centralizado.
 *
 * Existe à parte de `Indicadores` de propósito. O Dashboard ganhou outro
 * desenho para os big numbers (filete colorido, percentual em etiqueta), e a
 * importação não acompanha: as duas telas têm CSS próprio, sem dividir classe.
 */
function Indicador({ rotulo, valor, formato }) {
  const { numero } = useUnidade()
  // Contagem não é dinheiro: em "milhões", cinco linhas viravam "0,0".
  const texto = formato === 'inteiro' ? Number(valor ?? 0).toLocaleString('pt-BR') : numero(valor)
  return (
    <div className="indicador-imp">
      <div className="indicador-imp-rotulo">{rotulo}</div>
      <div className="indicador-imp-linha">
        <span className="indicador-imp-valor">{texto}</span>
      </div>
    </div>
  )
}

export default function IndicadoresImportacao({ itens }) {
  return (
    <div className="indicadores-imp">
      {itens.map((i) => (
        <Indicador key={i.chave} {...i} />
      ))}
    </div>
  )
}
