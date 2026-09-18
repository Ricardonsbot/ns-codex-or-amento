/**
 * Teste do SeletorColunas, sem navegador.
 *
 * O repo nao tem runner de teste; este roda sozinho e sai com codigo != 0 se
 * algo falhar:
 *
 *   cd app
 *   npx vite-node scripts/testar-seletor-colunas.mjs
 *
 * Precisa do vite-node porque o arquivo e JSX; o npx baixa na hora.
 *
 * Foi ele que apontou que a escolha salva estava sendo aplicada por um
 * useEffect — que nao roda no primeiro render. O componente passou a calcular a
 * escolha na inicializacao do estado, o que tirou o piscar de "tudo marcado" e
 * deixou o comportamento testavel sem DOM.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement as h } from 'react'
import SeletorColunas from '../src/components/SeletorColunas.jsx'

const guardado = new Map()
globalThis.localStorage = {
  getItem: (k) => guardado.get(k) ?? null,
  setItem: (k, v) => guardado.set(k, v),
}

const COLUNAS = [
  { key: 'codigo', label: 'Código', obrigatorio: true },
  { key: 'nome', label: 'Nome', obrigatorio: true },
  { key: 'linha_pl', label: 'Linha do P&L' },
  { key: 'categoria', label: 'Categoria' },
]

let falhas = 0
const ok = (cond, msg) => { console.log(`${cond ? '  ok  ' : ' FALHA'} ${msg}`); if (!cond) falhas++ }
const render = (props = {}) =>
  renderToStaticMarkup(h(SeletorColunas, { nomeArquivo: 'Contas', colunas: COLUNAS, onCancelar() {}, onConfirmar() {}, ...props }))
const escapar = (t) => t.replace(/&/g, '&amp;')

// 1. sem escolha salva
let html = render()
ok(html.includes('Colunas da exportação'), 'mostra o titulo')
for (const c of COLUNAS) ok(html.includes(escapar(c.label)), `lista "${c.label}"`)
ok((html.match(/type="checkbox"/g) ?? []).length === 4, 'uma caixa por coluna')
ok((html.match(/disabled=""/g) ?? []).length === 2, 'as duas obrigatorias travadas')
ok((html.match(/checked=""/g) ?? []).length === 4, 'sem escolha salva, todas marcadas')
ok(html.includes('4 de 4 coluna(s)'), 'contador diz 4 de 4')
ok(html.includes('sempre incluída'), 'marca a obrigatoria')

// 2. com escolha salva
guardado.set('colunas-exportacao:Contas', JSON.stringify(['codigo', 'nome', 'categoria']))
ok(render().includes('3 de 4 coluna(s)'), 'respeita a escolha salva')

// 3. escolha salva com coluna que nao existe mais
guardado.set('colunas-exportacao:Contas', JSON.stringify(['codigo', 'nome', 'coluna_que_sumiu']))
ok(render().includes('2 de 4 coluna(s)'), 'ignora coluna que nao existe mais, sem quebrar')

// 4. escolha salva que omite uma obrigatoria
guardado.set('colunas-exportacao:Contas', JSON.stringify(['linha_pl']))
ok(render().includes('3 de 4 coluna(s)'), 'reinsere as obrigatorias omitidas')

// 5. escolha salva corrompida
guardado.set('colunas-exportacao:Contas', '{nao é json')
ok(render().includes('4 de 4 coluna(s)'), 'json corrompido cai para todas')

// 6. cada arquivo lembra a sua propria escolha
guardado.set('colunas-exportacao:Contas', JSON.stringify(['codigo', 'nome']))
ok(render().includes('2 de 4 coluna(s)'), 'arquivo "Contas" com 2')
ok(render({ nomeArquivo: 'Outro' }).includes('4 de 4 coluna(s)'), 'arquivo "Outro" nao herda a escolha')

// 7. a chave de preferencia vale acima do nome do arquivo: o nome muda com o
//    recorte (Resultado_PL_BRK, Resultado_PL_Onisys) e a escolha nao pode mudar
guardado.set('colunas-exportacao:Resultado_PL', JSON.stringify(['codigo', 'nome', 'linha_pl']))
ok(
  render({ nomeArquivo: 'Resultado_PL_BRK', chavePreferencia: 'Resultado_PL' }).includes('3 de 4 coluna(s)'),
  'recorte diferente, mesma chave: mesma escolha'
)

// 8. colunas com grupo saem em blocos, cada um com o seu contador e botao
const COM_GRUPO = [
  { key: 'Empresa', grupo: 'Identificação', obrigatorio: true },
  { key: 'Conta', grupo: 'Identificação' },
  ...['Jan', 'Fev', 'Mar'].map((m) => ({ key: m, grupo: 'Valores base' })),
]
const g = render({ nomeArquivo: 'Grupos', colunas: COM_GRUPO })
ok(g.includes('Identificação') && g.includes('Valores base'), 'mostra o titulo de cada grupo')
ok(g.includes('3 de 3') && g.includes('2 de 2'), 'contador por grupo')
ok((g.match(/grupo<\/button>/g) ?? []).length === 2, 'um botao de grupo em cada bloco')
ok(!render().includes('seletor-colunas-grupo'), 'sem grupo, continua a lista simples')

// 9. sem localStorage
delete globalThis.localStorage
ok(render().includes('4 de 4 coluna(s)'), 'sem localStorage, cai para todas em vez de quebrar')

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo passou')
process.exitCode = falhas ? 1 : 0
