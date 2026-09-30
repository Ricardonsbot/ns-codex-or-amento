/**
 * Os ícones da interface, desenhados em traço e embutidos no código.
 *
 * São SVG de traço no estilo dos conjuntos abertos (Lucide, MIT), e não
 * imagem: assim cada ícone herda a cor de quem o contém (`currentColor`), que
 * é o que faz a seta de Revenue ficar verde, a de Expenses vermelha e o item
 * do menu virar laranja quando está ativo. Um PNG baixado pronto vem com a
 * cor gravada dentro e perderia isso.
 *
 * Não há arquivo para carregar nem requisição extra: cada ícone é um punhado
 * de coordenadas, e entra no bundle junto com o resto.
 */

const ICONES = {
  // painel de quadros
  dashboard: ['M3 3h7v7H3z', 'M14 3h7v4h-7z', 'M14 11h7v10h-7z', 'M3 14h7v7H3z'],
  // seta subindo: receita
  receita: ['M22 7 13.5 15.5 8.5 10.5 2 17', 'M16 7h6v6'],
  // seta descendo: despesa
  despesa: ['M22 17 13.5 8.5 8.5 13.5 2 7', 'M16 17h6v-6'],
  // prédio: investimento em ativo
  capex: ['M3 21h18', 'M5 21V7l7-4 7 4v14', 'M9 9h.01', 'M9 13h.01', 'M15 9h.01', 'M15 13h.01'],
  // seta entrando na bandeja: subir arquivo
  importar: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 9l5-5 5 5', 'M12 4v12'],
  aprovacao: ['M22 11.1V12a10 10 0 1 1-5.9-9.1', 'M22 5 12 15l-3-3'],
  pendencia: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  resultado: ['M3 3v18h18', 'M7 16v-5', 'M12 16V7', 'M17 16v-3'],
  lupa: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-3.5-3.5', 'M8.5 11h5'],
  relatorio: ['M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z', 'M14 3v6h6', 'M8 14h8', 'M8 18h6'],
  cadastros: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 21v-2a4 4 0 0 0-3-3.9'],
  ciclos: ['M4 21v-6', 'M4 11V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-4', 'M20 13V3', 'M1 15h6', 'M9 8h6', 'M17 17h6'],
  sair: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  // folha com a quina dobrada: bloco de notas
  nota: ['M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5z', 'M15 3v5h5', 'M8 13h8', 'M8 17h5'],
  // lapis: inserir/editar um lancamento
  inserir: ['M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .622.622l4.353-1.32a2 2 0 0 0 .83-.497Z', 'm15 5 4 4'],
  // seta saindo da bandeja: baixar arquivo (oposto de "importar")
  exportar: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],

  // ---- cadastros (a página de parâmetros)
  contas: ['M3 5h18v14H3z', 'M3 10h18', 'M8 15h3'],
  centroCusto: ['M20.6 13.4 12 22l-9-9V4a1 1 0 0 1 1-1h8l8.6 8.6a2 2 0 0 1 0 2.8z', 'M7.5 7.5h.01'],
  pacote: ['M21 8v8a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z', 'M3.3 7 12 12l8.7-5', 'M12 22V12'],
  subpacote: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  fornecedor: ['M10 17h4V5H2v12h3', 'M20 17h2v-4l-3-4h-5v8h2', 'M7.5 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M17.5 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  grupo: ['M3 21V8l6-5 6 5v13', 'M15 21V12h6v9', 'M7 12h.01', 'M7 16h.01', 'M11 12h.01', 'M11 16h.01'],
  empresa: ['M3 21h18', 'M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16', 'M15 21V11h4a2 2 0 0 1 2 2v8', 'M9 7h2', 'M9 11h2', 'M9 15h2'],
  cliente: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  produto: ['M12 2 2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
  target: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
  indice: ['M3 17l6-6 4 4 8-8', 'M17 7h4v4'],
  premissa: ['M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.2V17h6v-1.3c0-.8.4-1.6 1-2.2A6 6 0 0 0 12 3z', 'M9 21h6'],
  alcada: ['M12 3l8 4v5c0 4.4-3.4 8.2-8 9-4.6-.8-8-4.6-8-9V7l8-4z', 'M9 12l2 2 4-4'],
  aliquota: ['M19 5 5 19', 'M8 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'M16 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  diretoria: ['M4 21V7l8-4 8 4v14', 'M9 21v-6h6v6', 'M9 11h.01', 'M15 11h.01'],
  operacao: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z'],
  layout: ['M3 3h18v18H3z', 'M3 9h18', 'M9 21V9'],
  usuario: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M17 3.5a4 4 0 0 1 0 7'],
}

export default function Icone({ nome, tamanho = 18, className }) {
  const partes = ICONES[nome]
  if (!partes) return null
  return (
    <svg
      className={className}
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {partes.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
