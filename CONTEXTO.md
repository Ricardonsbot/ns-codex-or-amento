# Contexto do NS Codex — leia isto ao abrir um chat novo

> Estado em 07/08/2026, commit `cecf0ef`. Este arquivo substitui o contexto que
> era colado à mão. Num chat novo, basta pedir: **"leia CONTEXTO.md"**.

---

## 1. O que é

Maquete navegável do processo de **budget corporativo da NSTECH**. Não é o
produto — é o instrumento para alinhar o processo com a liderança **antes** de
construir o sistema.

| | |
|---|---|
| Pasta | `Área de Trabalho\ns-codex-orcamento` (é o clone com `origin`) |
| Repo | `https://github.com/Ricardonsbot/ns-codex-or-amento` (privado) |
| Branch | `main` |
| Rodar | servidor estático na porta 8081 → **`http://127.0.0.1:8081`** |
| Tamanho | 18 páginas · `app.js` 4.423 linhas · `style.css` 4.000 linhas · 12 JSON |

> Existe uma segunda cópia no SharePoint (porta 8080). **A que vale é a do
> Desktop.** O projeto Flask "Ferramenta Orçamentária" foi **parado** em
> 05/08/2026 — só se trabalha aqui.

---

## 2. Regras de arquitetura (não quebrar)

- **HTML/CSS/JS puro.** Sem backend, sem build step, sem framework.
- **Sem CDN e sem dependência externa.** O export em PDF é `window.print()`; o
  leitor e o gerador de `.xlsx` foram escritos à mão (ZIP + XML).
- **Um único JS** (`assets/js/app.js`) e **um único CSS** (`assets/css/style.css`).
- **Toda leitura de JSON passa por `carregarRef()`** — senão o navegador serve
  JSON velho do cache.
- Funções planas `initX()` registradas no `DOMContentLoaded`; seleção por
  `data-*`; `showToast()` para feedback; `escaparTexto()` antes de `innerHTML`.
- **Linhas de grade são clonadas** → usar **delegação de evento**, nunca
  listener preso na linha.
- Comentários e textos de tela em **português**, tom direto, sem jargão de TI.
- `ferramentas/*.py` são scripts de bastidor rodados na mão. **Não** são build
  step: o site lê só os JSON prontos.

---

## 3. O modelo de negócio

- **Hierarquia:** BU → Torre → Sub Torre → Empresa (3 BUs, 12 torres, 37 empresas).
- **P&L bridge:** Revenue → Expenses → EBITDA → Capex → EBITDA after Capex.
- **As três categorias não são simétricas:**

| | Como se lança |
|---|---|
| Receita | Torre → Empresa → Produto → Sub-produto → **Tipo de Receita** |
| Despesa | Conta → Empresa → Centro de Custo → **Pacote** → Ativação |
| Capex | Conta → Empresa → Centro de Custo → **Pacote** → Tipo de Ativo |

- **Pacote é o MOTIVO, não a natureza contábil.** Receita **não** tem pacote
  (saiu no commit `ba03567`); usa Tipo de Receita.
- **Ativação** (só em Despesa): quanto do gasto vira ativo. CPC 27 (imobilizado)
  e CPC 04 (intangível). Pesquisa é despesa obrigatória; desenvolvimento é
  capitalizável se os 6 critérios forem atendidos.
- **Índice acumula composto**, nunca soma: `(1+i₁)×(1+i₂)−1`.
- Valores das grades em **R$ mil**.

---

## 4. As 18 telas

**Orçamento:** `index` (dashboard) · `orcamento-receita` · `orcamento-despesa` ·
`orcamento-capex` · `importar` · `lancamento` · `visualizar-budget`

**Fluxo:** `entregas` · `aprovacoes` · `correcoes` · `notificacoes` · `auditoria`

**Análise e admin:** `relatorios` · `usuarios` · `layouts` · `indices` ·
`budget-settings` · `login`

Receita, Despesa e Capex têm o mesmo esqueleto: abas **Resumo / Lançar**,
formulário guiado por passos, **Phasing** e a grade completa atrás do
`<details>` "Prefere planilha?".

---

## 5. Os dados

Doze JSON em `Referencias/`. **As telas derivam das mesmas fontes para nunca
divergirem** — este é o princípio mais importante do projeto.

`organizacional` (37) · `contas` (36) · `produtos` (12) · `pacotes` (9) ·
`ativacao` · `premissas` (5) · `entregas` (37) · `aprovacoes` (68 submissões) ·
`cronograma` · `notificacoes` · `auditoria` (360 eventos) · `inputs` (245 linhas)

Dependências reais: `aprovacoes` deriva de `entregas`; `auditoria` e `inputs`
são **gerados** de `aprovacoes` por `ferramentas/*.py`. Por isso 39 aprovados,
3 reprovados, 6 devolvidos e 23 aceites batem em qualquer tela.

**Os dados REAIS da NSTECH já estão no repo**, em `.xlsx`: 630 contas
(`tbl_KMM_Contas.xlsx`) e 3.245 linhas organizacionais
(`tbl_KMM_Organizacional.xlsx`). Os JSON usam ~6% disso, curado à mão. Ver
`BANCO-DE-DADOS.md` §2.

---

## 6. Banco de dados (novo, não ligado)

`banco/*.sql` — 7 arquivos, 30 tabelas em PostgreSQL, mais o guia
`BANCO-DE-DADOS.md`. Passam pelo parser oficial (libpg_query), **não foram
executados**.

Cinco decisões embutidas: uma linha por mês (nunca 12 colunas); versão fechada
imutável; `uuid` estável por lançamento para o ida-e-volta com Excel; valores em
reais com centavos (`numeric`, nunca `float`); realizado em tabela separada do
orçado.

Postgres foi escolhido pela **Row Level Security** — a permissão mora no banco,
não no código da tela.

---

## 7. Armadilhas já pagas (não repetir)

**Do JS:**
- **Um `init` que estoura mata todos os posteriores** no `DOMContentLoaded`. O
  sintoma aparece longe da causa: ao montar o Capex, sumiram a barra de versão,
  o autocomplete e o resumo. Se uma tela "não carrega nada", olhe o console e
  procure o primeiro `init` que falhou.
- `initFormLancamento` assumia que todo formulário guiado tem os elementos do de
  Despesa (`data-form-meses`, `data-form-variavel`, `data-form-limpar`).
  Corrigido com guardas — mas o padrão pode existir noutros lugares.
- **`[hidden]` não esconde elemento com `display` na classe.** Toda classe com
  `display: flex/grid/block` que usa `hidden` precisa de
  `.classe[hidden] { display: none; }`.
- `colunaPorTitulo(tabela, "")` casa com o `<th>` vazio da coluna de ações.
- `new Event('change')` sem `{ bubbles: true }` não chega em listener delegado.

**Do CSS:**
- **Coluna de grid `1fr` não segura conteúdo largo** — tem `min-width: auto` por
  padrão. Use `minmax(0, 1fr)`, senão a coluna é empurrada para fora da tela em
  vez de rolar dentro do `.table-wrap`.
- `calc()` não multiplica porcentagem por porcentagem.
- `.proto-banner` com `display: flex` embaralha texto com `<strong>` dentro.

**Da verificação — importantes:**
- **Cache do navegador mordeu três vezes nesta sessão.** Ao testar, use
  `?v=N` na URL. Se a tela vier estranha, é quase sempre isso.
- **Viewport zero.** Quando o painel do navegador está fechado,
  `document.documentElement.clientWidth` é **0** e *tudo* parece estourar. Antes
  de investigar layout, confira se a largura é real — já deu falso positivo.
- **O console acumula erros entre navegações.** Ver um erro não prova que ele é
  da carga atual.
- Ao editar HTML por script Python, ancore em string com a quebra de linha.

---

## 8. Decisões pendentes (são suas, não minhas)

1. **TI:** dado financeiro da NSTECH pode ir para serviço fora do tenant
   Microsoft? Isso bloqueia o passo 0 do banco.
2. **De/para Torre → BU** não existe nos `.xlsx`. São 12 linhas a escrever à mão.
3. **Pacote NOV (Novos Contratos) está órfão** — só servia receita, e o conceito
   dele não é coberto por nenhum dos 4 Tipos de Receita.
4. **`try/catch` por `init`** no `DOMContentLoaded`, para a página degradar em
   vez de morrer. Muda o comportamento de todas as telas de uma vez.

---

## 9. Roadmap ainda aberto

O `ROADMAP.md` numerado mora no **projeto Flask** (parado), mas os itens são
implementados aqui. Em aberto: **17** (copiar orçamento anterior), **21**
(dashboard executivo + PowerPoint), **22** (orçado vs. realizado — destrava RFC
e Δ R$ / Δ % na receita), **23** (simulação de cenários).

Também aberto: **retificação de número já aprovado** (mexer no que o líder já
assumiu) e **carregar o cadastro real dos `.xlsx`** para o protótipo sair das
36 contas de brinquedo.

---

## 10. Como o Ricardo trabalha

- **Um commit por funcionalidade**, mensagem em português **sem acentos**
  (convenção deste repo), corpo explicando o *porquê*.
- **Commit e push são pedidos explicitamente.** Não subir por conta própria.
- **Verificar no navegador antes de comitar** e relatar com os números reais.
- Se algo do pedido não foi feito, **dizer claramente o que ficou de fora e por quê**.

---

## 11. O que foi feito na sessão de 06–07/08/2026

```
27ded6a  trilha de auditoria com o historico de cada lancamento
a57b4b0  trilha de auditoria com export, deep link e atalho das grades
ac2befc  importar planilha de Receita, Despesa e Capex em .xlsx e .csv
3477bfa  pacotes.json alinhado ao modelo e Auditoria exportando em PDF
c1bc88d  schema PostgreSQL do orcamento, em sete passos executaveis
466f85e  barra de versao em edicao nas tres telas, lendo o cronograma
df7e0b4  tela de correcao para o que o aprovador devolveu
fc5c7ff  aprovacao de inputs orcamentarios do ciclo seguinte
c731d63  aprovacao unificada — entrega e linhas na mesma tela
cecf0ef  Capex sai de "em construcao" e ganha grade, formulario e efeito no P&L
```

Destaques: **Auditoria** (360 eventos, quem mexeu em cada número),
**Importação** de `.xlsx` e `.csv` sem biblioteca, **Correções** (o que o
aprovador devolveu), **Aprovações unificada** (entrega + linhas, e a entrega não
aprova com linha pendente) e **Capex completo** com o painel *"O que este Capex
vira no P&L"*.

`fc5c7ff` criou uma tela avulsa de aprovação de inputs que `c731d63`
**removeu**, incorporando-a à tela de Aprovações. Se encontrar referência a
`aprovacao-inputs.html`, é resíduo.
