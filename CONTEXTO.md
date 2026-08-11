# Contexto do NS Codex — leia isto ao abrir um chat novo

> Estado em 11/08/2026, commit `09e9d9a`. Este arquivo substitui o contexto que
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
| Tamanho | 19 páginas · `app.js` 5.381 linhas · `style.css` 4.112 linhas · 13 JSON |

> **Cuidado com a cópia errada.** Existe uma segunda cópia no SharePoint, e ela
> está velha. No `launch.json` do projeto vizinho as duas estão mapeadas:
> `ns-codex` aponta para a do SharePoint (porta 8080) e **`ns-codex-github`
> aponta para a do Desktop (porta 8081), que é a que vale.** Servir a errada
> dá 404 em arquivo que existe, e o sintoma parece outra coisa.
>
> O projeto Flask "Ferramenta Orçamentária" foi **parado** em 05/08/2026 — só
> se trabalha aqui.

---

## 2. Regras de arquitetura (não quebrar)

- **HTML/CSS/JS puro.** Sem backend, sem build step, sem framework.
- **Sem CDN e sem dependência externa.** O export em PDF é `window.print()`; o
  leitor e o gerador de `.xlsx` e o gerador de `.pptx` foram escritos à mão
  (ZIP + XML).
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

- **Hierarquia:** BU → Torre → Sub Torre → Empresa. **3 BUs, 15 torres, 50
  empresas.** As 12 torres operacionais vêm de `deparaempresas.xlsx`; as três
  de Corporate (G&A, S&M, R&D) não estão lá e seguem escritas à mão.

| BU | Torres |
|---|---|
| PSL | Torre ICP Pequeno e Micro · Torre ICP Médio e Grande · TMS Cabotagem · Fintech · Torre Mobilidade · Buonny · Atua Redes |
| Embarcador | Torre VGR · YMS/WMS · Torre SW Embarcador · Mídia · Insurance Market |
| Corporate | G&A · S&M · R&D |

- **P&L bridge:** Revenue → Expenses → EBITDA → Capex → EBITDA after Capex.
- **As três categorias não são simétricas:**

| | Como se lança |
|---|---|
| Receita | Torre → Empresa → Produto → Sub-produto → **Tipo de Receita** |
| Despesa | Conta → Empresa → Centro de Custo → **Pacote** → Ativação |
| Capex | Conta → Empresa → Centro de Custo → **Pacote** → Tipo de Ativo |

- **Receita não tem conta contábil.** É o caminho dela que classifica. A tela
  de Receita não oferece plano de contas nem centro de custo.
- **Cada tela só aceita conta da sua categoria** — Despesa sugere 292 contas,
  Capex sugere 12. A categoria sai do prefixo da linha do P&L
  (`Receita >`, `Despesas >`, `Capex >`), e a tradução mora num lugar só:
  `categoriaDaConta()` em `app.js`.
- **Pacote é o MOTIVO, não a natureza contábil.** Receita **não** tem pacote
  (saiu no commit `ba03567`); usa Tipo de Receita.
- **Ativação** (só em Despesa): quanto do gasto vira ativo. CPC 27 (imobilizado)
  e CPC 04 (intangível). Pesquisa é despesa obrigatória; desenvolvimento é
  capitalizável se os 6 critérios forem atendidos.
- **Índice acumula composto**, nunca soma: `(1+i₁)×(1+i₂)−1`.
- Valores das grades em **R$ mil**. Totais consolidados aparecem em R$ mi.

---

## 4. As 19 telas

**Orçamento:** `index` (dashboard) · `orcamento-receita` · `orcamento-despesa` ·
`orcamento-capex` · `importar` · `lancamento` · `visualizar-budget`

**Fluxo:** `entregas` · `aprovacoes` · `correcoes` · `notificacoes` · `auditoria`

**Análise e admin:** `relatorios` · **`dashboard-executivo`** · `usuarios` ·
`layouts` · `indices` · `budget-settings` · `login`

Receita, Despesa e Capex têm o mesmo esqueleto: abas **Resumo / Lançar**,
formulário guiado por passos, **Phasing** e a grade completa atrás do
`<details>` "Prefere planilha?".

---

## 5. Os dados

Treze JSON em `Referencias/`. **As telas derivam das mesmas fontes para nunca
divergirem** — este é o princípio mais importante do projeto.

| Arquivo | Conteúdo |
|---|---|
| `organizacional` | 52 linhas · 50 empresas em 15 torres |
| `contas` | 404 contas orçáveis (100 receita, 292 despesa, 12 capex) |
| `centros-custo` | 171 centros de custo reais |
| `produtos` | 40 produtos + 4 tipos de receita |
| `pacotes` | 9 pacotes (motivo do gasto) |
| `inputs` | 261 linhas — o que compõe cada submissão |
| `aprovacoes` | 68 submissões |
| `entregas` | 37 entregas |
| `auditoria` | 360 eventos |
| `cronograma` · `premissas` · `ativacao` · `notificacoes` | apoio |

Dependências reais: `aprovacoes` deriva de `entregas`; `auditoria` e `inputs`
são **gerados** de `aprovacoes` por `ferramentas/*.py`. Por isso os totais
batem em qualquer tela.

**O cadastro real da NSTECH já está carregado.** Três `.xlsx` versionados em
`Referencias/`, lidos por `ferramentas/carrega_cadastro.py`:

- `tbl_KMM_Contas.xlsx` — 635 contas, das quais 404 são orçáveis (as 231 de
  balanço ficam de fora: não se orça saldo patrimonial).
- `tbl_KMM_Organizacional.xlsx` — 3.284 linhas; de onde saem as empresas e os
  centros de custo.
- `deparaempresas.xlsx` — BU → Torre → Produto_BaseRecebimento. É a de/para que
  faltava.

**Armadilha desta planilha:** a coluna `FPA_Pacote` **não** é pacote — guarda a
linha do P&L. Pacote neste produto é o motivo do gasto, e isso não existe em
`.xlsx` nenhum. `pacotes.json` continua escrito à mão.

Para recarregar tudo depois de mexer nos `.xlsx`:

```
python ferramentas/carrega_cadastro.py
python ferramentas/gera_inputs.py
python ferramentas/gera_auditoria.py
```

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
  sintoma aparece longe da causa. Se uma tela "não carrega nada", olhe o console
  e procure o primeiro `init` que falhou.
- `initFormLancamento` assumia que todo formulário guiado tem os elementos do de
  Despesa. Corrigido com guardas — mas o padrão pode existir noutros lugares.
- **`[hidden]` não esconde elemento com `display` na classe.** Toda classe com
  `display: flex/grid/block` que usa `hidden` precisa de
  `.classe[hidden] { display: none; }`.
- `colunaPorTitulo(tabela, "")` casa com o `<th>` vazio da coluna de ações.
- `new Event('change')` sem `{ bubbles: true }` não chega em listener delegado.
- **Init que preenche tabela por fetch precisa religar o que roda no
  `DOMContentLoaded`.** `initHierarchyCollapse()` varre linhas que ainda não
  existem quando a tela monta a grade depois.

**Do CSS:**
- **Coluna de grid `1fr` não segura conteúdo largo** — tem `min-width: auto` por
  padrão. Use `minmax(0, 1fr)`.
- `calc()` não multiplica porcentagem por porcentagem.
- `.proto-banner` com `display: flex` embaralha texto com `<strong>` dentro.

**Dos dados:**
- **Trocar um JSON de catálogo deixa órfã a linha de exemplo fixa no HTML.**
  Aconteceu duas vezes: contas inventadas nas grades de Despesa e Capex, e
  produtos que sumiram na grade de Receita. Depois de trocar catálogo,
  **varra as grades** conferindo código, linha do P&L e categoria.
- **Renomear torre respinga em três arquivos.** `entregas.json` e
  `aprovacoes.json` guardam `bu`/`torre` próprios, e o cargo do líder aparece
  congelado dentro do aceite final. `carrega_cadastro.py` reescreve os três.

**Da verificação — importantes:**
- **Cache do navegador mordeu várias vezes.** `?v=N` na URL da página **não**
  atualiza `app.js` nem `style.css`, que são pedidos pelo mesmo endereço. O que
  funciona: `fetch(url, {cache:"reload"})` nos assets e só então recarregar.
- **Viewport zero.** Quando o painel do navegador está fechado,
  `document.documentElement.clientWidth` é **0** e *tudo* parece estourar.
- **O console acumula erros entre navegações.** Ver um erro não prova que ele é
  da carga atual.
- Ao editar HTML por script Python, ancore em string com a quebra de linha, e
  **prefira trocar a tag inteira a usar backreferência de regex** — um `\1`
  malposto comeu o `list="..."` de sete campos de uma vez.
- **O `.pptx` gerado dá para conferir com `python-pptx`** (abre, conta slides,
  lê tabelas). Não substitui abrir no PowerPoint de verdade, que ainda não foi
  feito.

---

## 8. Decisões pendentes (são suas, não minhas)

1. **TI:** dado financeiro da NSTECH pode ir para serviço fora do tenant
   Microsoft? Isso bloqueia o passo 0 do banco.
2. **Pacote NOV (Novos Contratos) está órfão** — só servia receita, e o conceito
   dele não é coberto por nenhum dos 4 Tipos de Receita.
3. **`try/catch` por `init`** no `DOMContentLoaded`, para a página degradar em
   vez de morrer. Muda o comportamento de todas as telas de uma vez.
4. **Nove empresas foram encaixadas por inferência**, não por leitura de
   planilha: as variantes `- Compartilhado` e `- Corporate` dos grupos ATS, Atua
   e Praxio, mais KMM - Gridnet, Atua Sistemas e as duas grafias duplicadas de
   GBM. Estão marcadas com `[?]` linha a linha em `carrega_cadastro.py`.
5. **"GBM - Consultoria" e "Gbm Consultoria"** parecem ser a mesma empresa que
   "GBM Consultoria", com grafia diferente no ERP. A limpeza é na origem.
6. **O número do Dashboard não bate com o do Dashboard Executivo.** `index` e
   `relatorios` têm a ponte fixa no HTML (R$ 184,2 mi de Revenue, ciclo 2026); o
   Dashboard Executivo deriva de `inputs.json` (R$ 68,9 mi, ciclo 2027). Fazer
   as duas primeiras derivarem da mesma fonte resolve, mas mexe em tela já
   aprovada.

> **De/para Torre → BU: resolvido** em 11/08/2026 por `deparaempresas.xlsx`.
> Toda empresa tem BU e Torre; nenhuma ficou em `-`.

---

## 9. Roadmap ainda aberto

O `ROADMAP.md` numerado mora no **projeto Flask** (parado), mas os itens são
implementados aqui. Em aberto: **17** (copiar orçamento anterior), **22**
(orçado vs. realizado — destrava RFC e Δ R$ / Δ % na receita), **23**
(simulação de cenários).

Também aberto: **retificação de número já aprovado** (mexer no que o líder já
assumiu) e **sub-produto**, que ficou vazio porque a de/para para no produto.

Fechados: **21** (dashboard executivo + PowerPoint) e **carregar o cadastro real
dos `.xlsx`**, ambos em 11/08/2026.

---

## 10. Como o Ricardo trabalha

- **Um commit por funcionalidade**, mensagem em português **sem acentos**
  (convenção deste repo), corpo explicando o *porquê*.
- **Commit e push são pedidos explicitamente.** Não subir por conta própria.
- **Verificar no navegador antes de comitar** e relatar com os números reais.
- Se algo do pedido não foi feito, **dizer claramente o que ficou de fora e por quê**.

---

## 11. O que foi feito

**Sessão de 10–11/08/2026**

```
0d96558  dashboard executivo com PowerPoint e o cadastro real da NSTECH
09e9d9a  cada tela so oferece e so aceita conta da sua categoria
```

Duas frentes. O **Dashboard Executivo** (19ª tela) responde numa tela só qual é
o número, quanto mudou contra a base, quem mexeu nele, quanto já passou pelo
aprovador e o que falta entregar — tudo derivado de `inputs.json`. O
**PowerPoint** sai do mesmo objeto que desenhou a tela, não do HTML: painel e
slide são a mesma conta lida duas vezes. O gerador de `.pptx` reaproveita o ZIP
que o `.xlsx` já tinha e monta a corrente que o PowerPoint cobra para não pedir
reparo (apresentação → master → layout → tema).

E o **cadastro real** entrou: 36 contas de brinquedo viraram 404, apareceram 171
centros de custo e 12 contas de Capex de verdade, e a de/para fechou a
hierarquia em 50 empresas. Como a Torre TMS virou três torres, `entregas`,
`aprovacoes` e os cargos de líder foram reescritos junto.

**Sessão de 06–07/08/2026**

```
27ded6a  trilha de auditoria com o historico de cada lancamento
a57b4b0  trilha de auditoria com export, deep link e atalho das grades
ac2befc  importar planilha de Receita, Despesa e Capex em .xlsx e .csv
3477bfa  pacotes.json alinhado ao modelo e Auditoria exportando em PDF
c1bc88d  schema PostgreSQL do orcamento, em sete passos executaveis
466f85e  barra de versao em edicao nas tres telas, lendo o cronograma
df7e0b4  tela de correcao para o que o aprovador devolveu
c731d63  aprovacao unificada — entrega e linhas na mesma tela
cecf0ef  Capex sai de "em construcao" e ganha grade, formulario e efeito no P&L
```

Destaques: **Auditoria** (quem mexeu em cada número), **Importação** de `.xlsx`
e `.csv` sem biblioteca, **Correções** (o que o aprovador devolveu),
**Aprovações unificada** (a entrega não aprova com linha pendente) e **Capex
completo** com o painel *"O que este Capex vira no P&L"*.

`fc5c7ff` criou uma tela avulsa de aprovação de inputs que `c731d63`
**removeu**, incorporando-a à tela de Aprovações. Se encontrar referência a
`aprovacao-inputs.html`, é resíduo.
