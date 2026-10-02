# Contexto do NS Codex — leia isto ao abrir um chat novo

> Estado em 13/08/2026, commit `a6d34b5`. Num chat novo, basta pedir:
> **"leia CONTEXTO.md"**.

---

## 1. O que é

Maquete navegável do processo de **budget corporativo da NSTECH**. Não é o
produto — é o instrumento para alinhar o processo com a liderança **antes** de
construir o sistema. Está em **período de testes**: o Ricardo enviou o pacote
para o chefe usar.

| | |
|---|---|
| Pasta | `Área de Trabalho\ns-codex-orcamento` (é o clone com `origin`) |
| Repo | `https://github.com/Ricardonsbot/ns-codex-or-amento` (privado) |
| Branch | `main` |
| Rodar | duplo clique no `index.html`, **ou** `python ferramentas/servidor.py` (8081) |
| Tamanho | 19 páginas · `app.js` 5.829 linhas · `style.css` 4.115 · 18 JSON · 7 scripts |

> **Cuidado com a cópia errada.** Existe uma segunda cópia no SharePoint, e ela
> está velha. No `launch.json` do projeto vizinho as duas estão mapeadas:
> `ns-codex` aponta para a do SharePoint (8080) e **`ns-codex-github` para a do
> Desktop (8081), que é a que vale.** Servir a errada dá 404 em arquivo que
> existe, e o sintoma não parece cache.
>
> O projeto Flask "Ferramenta Orçamentária" foi **parado** em 05/08/2026.

---

## 2. Regras de arquitetura (não quebrar)

- **HTML/CSS/JS puro.** Sem backend, sem build step, sem framework.
- **Sem CDN e sem dependência externa.** O PDF é `window.print()`; o leitor e o
  gerador de `.xlsx` e o gerador de `.pptx` foram escritos à mão (ZIP + XML).
- **Um único JS** (`assets/js/app.js`) e **um único CSS** (`assets/css/style.css`).
- **Toda leitura de JSON passa por `carregarRef()`.** Ele tenta o `fetch` e, se
  não houver servidor (`file://`), cai na cópia embutida em `assets/js/dados.js`.
- Funções planas `initX()` registradas no `DOMContentLoaded`; seleção por
  `data-*`; `showToast()` para feedback; `escaparTexto()` antes de `innerHTML`.
- **Linhas de grade são clonadas** → delegação de evento, nunca listener na linha.
- Comentários e textos de tela em **português**, tom direto, sem jargão de TI.
- `ferramentas/*.py` são scripts de bastidor rodados na mão. **Não** são build
  step: o site lê só os JSON prontos.

---

## 3. O modelo de negócio

**Hierarquia:** BU → Torre → Sub Torre → Empresa. **3 BUs, 15 torres, 50 empresas.**

| BU | Torres |
|---|---|
| PSL | Torre ICP Pequeno e Micro · Torre ICP Médio e Grande · TMS Cabotagem · Fintech · Torre Mobilidade · Buonny · Atua Redes |
| Embarcador | Torre VGR · YMS/WMS · Torre SW Embarcador · Mídia · Insurance Market |
| Corporate | G&A · S&M · R&D |

**P&L bridge:** Revenue → Expenses → EBITDA → Capex → EBITDA after Capex.

**As três categorias não são simétricas:**

| | Como se lança |
|---|---|
| Receita | Empresa → **Cliente (CNPJ)** → Produto → Tipo Receita → Categoria |
| Despesa | Conta → Empresa → Centro de Custo → Motivo → Ativação |
| Capex | Conta → Projeto → Centro de Custo → Tipo de Ativo |

- **Receita se lança por CONTRATO.** A linha é o cliente: CNPJ e razão social.
  Preenchendo um dos dois o outro vem, com PMR, persona, setor, segmento e
  classe. **Receita não tem conta contábil** — o caminho dela é que classifica.
- **Cada tela só aceita conta da sua categoria** (Despesa 313, Capex 12,
  Receita nenhuma). A categoria sai do prefixo da linha do P&L, e a tradução
  mora só em `categoriaDaConta()`.
- **Ativação** (só em Despesa): quanto do gasto vira ativo. CPC 27 e CPC 04.
- **Índice acumula composto**, nunca soma: `(1+i₁)×(1+i₂)−1`.
- Valores das grades em **R$ mil**. Totais consolidados em R$ mi.

### As três palavras que significam duas coisas

Isto custou muito tempo. Se você mexer em cadastro, leia antes:

| Palavra | No template / ERP | Na plataforma |
|---|---|---|
| **Pacote** | agrupamento de FP&A (Personnel Costs, Travels/Rental/Generals) — **atributo da conta** | era o **motivo** do gasto (Operação Base, Novos Contratos) |
| **Tipo Receita** | **movimento**: base, venda nova, expansão, churn | era natureza |
| **Categoria** | **natureza**: SaaS, On Premise, implantação | era o subpacote da conta |

Hoje a grade usa os nomes do template. Pacote e Subpacote **se preenchem
sozinhos ao escolher a conta**. A coluna **Motivo** guarda o conceito da
plataforma, que **não existe em template nenhum** — é disciplina nova que
alguém terá de preencher.

---

## 4. As 19 telas

**Orçamento:** `index` (dashboard) · `orcamento-receita` · `orcamento-despesa` ·
`orcamento-capex` · `importar` · `lancamento` · `visualizar-budget`

**Fluxo:** `entregas` · `aprovacoes` · `correcoes` · `notificacoes` · `auditoria`

**Análise e admin:** `relatorios` · `dashboard-executivo` · `usuarios` ·
`layouts` · `indices` · `budget-settings` · `login`

As três de orçamento têm abas **Resumo / Lançar na planilha**. **A grade é o
caminho principal** — quem orça entra com centenas de linhas, não uma por vez.
O formulário guiado ficou recolhido atrás de `<details class="modo-guiado">`.

---

## 5. Os dados

Dezoito JSON em `Referencias/`. **As telas derivam das mesmas fontes para nunca
divergirem** — este é o princípio mais importante do projeto.

| Arquivo | Conteúdo |
|---|---|
| `contas` | **425 contas** (100 receita, 313 despesa, 12 capex); 207 com pacote e subpacote |
| `pacotes-fpa` | 10 pacotes de FP&A com seus subpacotes — **atributo da conta** |
| `pacotes` | 9 pacotes-**motivo** — conceito da plataforma, sem fonte externa |
| `centros-custo` | 104 centros com código, nome, diretoria e grupo |
| `organizacional` | 52 linhas · 50 empresas em 15 torres |
| `produtos` | 67 produtos, 14 com sub-produto (33 no total) |
| `clientes` | **3.797 CNPJs** com razão social, PMR, persona, setor, segmento, classe |
| `fornecedores` | 1.040 fornecedores, 20 projetos, 5 áreas, 6 responsáveis |
| `dimensoes-receita` | os dois eixos: 5 movimentos, 16 naturezas, personas, setores |
| `indices-reajuste` | índice acumulado 12m por mês de aniversário (IGP-M, IPCA, INPC, Livre, Dólar) |
| `inputs` (261) · `aprovacoes` (68) · `entregas` (37) · `auditoria` (360) | o ciclo simulado |
| `cronograma` · `premissas` · `ativacao` · `notificacoes` | apoio |

### As cinco planilhas de origem

Todas versionadas em `Referencias/`, lidas só pelos scripts de bastidor:

| Planilha | O que dá |
|---|---|
| `tbl_KMM_Contas.xlsx` | 635 contas, 404 orçáveis |
| `tbl_KMM_Organizacional.xlsx` | empresas e centros de custo |
| `deparaempresas.xlsx` | **BU → Torre → Produto** — a de/para que faltava |
| `template-budget-psl.xlsx` | lançamentos: carteira, fornecedores, os dois eixos |
| `template-budget-torres.xlsb` | **cadastro**: pacote×linha do P&L, sub-produto, centros |

### Para recarregar tudo

```
python ferramentas/carrega_cadastro.py          # contas, centros, org, produtos
python ferramentas/carrega_template.py          # carteira, dimensões, índices (PSL)
python ferramentas/carrega_template_torres.py   # pacotes, sub-produtos (~2 min, .xlsb)
python ferramentas/gera_inputs.py               # inputs.json
python ferramentas/gera_auditoria.py            # auditoria.json
python ferramentas/semeia_grades.py             # 60/60/19 linhas nas grades
python ferramentas/gera_dados_embutidos.py      # SEMPRE por último
```

**`gera_dados_embutidos.py` é obrigatório no fim**, e faz duas coisas:
reescreve `assets/js/dados.js` (o que o app lê no duplo clique) e **carimba a
versão dos assets nas 19 páginas**. Sem rodar, o navegador continua servindo a
tela antiga mesmo com o disco certo — foi assim que a tela apareceu
desatualizada em 13/08.

---

## 6. O pacote de testes

- Zipar a pasta → duplo clique no `index.html`. Sem Python, sem servidor, sem rede.
- `COMO-TESTAR.md` explica o que é real e o que é simulado.
- `ABRIR NS CODEX.bat` é atalho opcional (sobe servidor se houver Python).
- Dá para tirar `Referencias/` do zip: o app não precisa dela.
- **Nada persiste.** Fechou o navegador, volta ao estado original.

---

## 7. Banco de dados (novo, não ligado)

`banco/*.sql` — 7 arquivos, 30 tabelas em PostgreSQL, mais `BANCO-DE-DADOS.md`.
Passam pelo parser oficial, **não foram executados**. Postgres foi escolhido
pela Row Level Security — a permissão mora no banco, não na tela.

---

## 8. Armadilhas já pagas (não repetir)

**Do JS:**
- **Um `init` que estoura mata todos os posteriores.** O sintoma aparece longe
  da causa. Aconteceu de novo ao remover um `<select>`: `encher()` sem guarda
  de `null`. Se uma tela "não carrega nada", ache o primeiro `init` que falhou.
- **`[hidden]` não vence `display` na classe.**
- **Init que preenche tabela por fetch precisa religar o que roda no
  `DOMContentLoaded`** (`initHierarchyCollapse`).
- **Dois donos do mesmo datalist** viram corrida: quem preencher por último
  vence, e isso depende de qual fetch voltar antes.
- `new Event('change')` sem `{ bubbles: true }` não chega em listener delegado.

**Do CSS:**
- **Coluna de grid `1fr` não segura conteúdo largo** — use `minmax(0, 1fr)`.
- `calc()` não multiplica porcentagem por porcentagem.

**Dos dados:**
- **Trocar um JSON de catálogo deixa órfã a linha de exemplo fixa no HTML.**
  Aconteceu três vezes. Depois de trocar catálogo, **varra as grades**.
- **Renomear torre respinga em três arquivos** — `entregas`, `aprovacoes` e o
  cargo do líder congelado dentro do aceite final.
- **Cabeçalho e corpo da grade têm de ter o mesmo número de colunas**, colspan
  incluído. O Capex ficou com 29 células numa tabela de 22 e ninguém viu.
- **O template repete linha legitimamente**: 131 idênticas em todas as colunas
  com 109 valores diferentes. Duplicidade é alerta, não erro.
- **Data no `.xlsx` é número de série**, não texto.
- **CNPJ vem nos dois formatos** — comparar sempre por dígito.
- **`.xlsb` é outro formato**, não um `.xlsx` renomeado. O leitor não abre.

**Da verificação:**
- **Cache do navegador servindo tela velha** foi o defeito mais teimoso do
  projeto. **Está resolvido nas duas pontas:**
  - **Desenvolvendo:** use `python ferramentas/servidor.py` — é o que o
    `ns-codex-github` e o `.bat` chamam. Ele manda `no-store` em toda resposta,
    então o navegador nunca guarda cópia: editou, salvou, F5, apareceu. **Não**
    use `python -m http.server`: ele não manda Cache-Control, o Chrome decide
    sozinho por quanto tempo confia no que já tem, e foi assim que a tela abriu
    desatualizada em 13/08.
  - **No zip de quem testa** (`file://`, sem servidor): vale o carimbo
    `?v=<hash do conteúdo>` que `gera_dados_embutidos.py` põe nas 19 páginas,
    mais `Cache-Control: no-cache` no `<head>`. Ali o cache é bem-vindo — o
    `dados.js` tem 1,5 MB e desceria de novo a cada clique no menu.
- **Viewport zero** quando o painel do navegador está fechado.
- **O console acumula erros entre navegações.**
- Ao editar HTML por script, **prefira trocar a tag inteira a usar
  backreferência de regex** — um `\1` malposto comeu o `list=` de sete campos.
- **O `.pptx` dá para conferir com `python-pptx`.** Não substitui abrir no
  PowerPoint, **que ainda não foi feito**.

---

## 9. Decisões pendentes (são suas, não minhas)

1. **TI:** dado financeiro da NSTECH pode ir para serviço fora do tenant
   Microsoft? **A carteira com 3.797 CNPJs e 20 MB de planilha já estão no
   GitHub** — desfazer exige reescrever histórico, não basta remover.
2. **O pacote-motivo vai existir?** Não está em template nenhum. Ou vira
   disciplina nova no lançamento, ou a coluna Motivo sai.
3. **Nove empresas foram encaixadas por inferência**, não por leitura de
   planilha — marcadas `[?]` em `carrega_cadastro.py`.
4. **"GBM - Consultoria" e "Gbm Consultoria"** parecem a mesma empresa que
   "GBM Consultoria". A limpeza é na origem.
5. **O número do Dashboard não bate com o do Dashboard Executivo.** `index` e
   `relatorios` têm a ponte fixa no HTML (R$ 184,2 mi, ciclo 2026); o Executivo
   deriva de `inputs.json` (R$ 68,9 mi, ciclo 2027).
6. **`try/catch` por `init`** no `DOMContentLoaded`, para a página degradar em
   vez de morrer.

---

## 10. Roadmap ainda aberto

O `ROADMAP.md` numerado mora no projeto Flask (parado), mas os itens são
implementados aqui. Em aberto: **17** (copiar orçamento anterior), **22**
(orçado vs. realizado), **23** (simulação de cenários).

Também aberto: **retificação de número já aprovado** e o **cálculo do reajuste
pelo aniversário** — o índice e o mês já estão na linha, a conta não existe.

Fechados: **21** (dashboard executivo + PowerPoint) e o carregamento do
cadastro real, ambos em 11–13/08/2026.

---

## 11. Como o Ricardo trabalha

- **Um commit por funcionalidade**, mensagem em português **sem acentos**
  (convenção deste repo), corpo explicando o *porquê*.
- **Commit e push são pedidos explicitamente.** Não subir por conta própria.
- **Verificar no navegador antes de comitar** e relatar com os números reais.
- Se algo do pedido não foi feito, **dizer claramente o que ficou de fora e por quê**.

---

## 12. O que foi feito

**Sessão de 12–13/08/2026** — `2767e30`

O Template Budget virou o modelo do input: a grade de Receita ganhou as colunas
da aba Base Receita na ordem dela, os dois eixos foram separados e a receita
passou a se lançar por contrato. A grade virou o caminho principal, o
formulário guiado ficou recolhido. O cadastro do template das Torres trouxe
pacote e subpacote por conta, sub-produto e 104 centros de custo. E o app
passou a abrir com duplo clique, via `assets/js/dados.js`.

**Sessão de 11/08/2026** — `0d96558` `09e9d9a` `53deeef`

Dashboard Executivo (19ª tela) com gerador de PowerPoint escrito à mão sobre o
mesmo ZIP do `.xlsx`; o deck sai do objeto que desenha a tela, não do HTML.
Cadastro real: 36 contas de brinquedo viraram 404, e `deparaempresas.xlsx`
fechou a hierarquia em 50 empresas. Cada tela passou a só aceitar conta da sua
categoria.

**Sessão de 06–07/08/2026** — `27ded6a` a `cecf0ef`

Auditoria (360 eventos), importação de `.xlsx` e `.csv` sem biblioteca,
Correções, Aprovações unificada e Capex completo com o painel *"O que este
Capex vira no P&L"*.

`fc5c7ff` criou uma tela avulsa de aprovação de inputs que `c731d63`
**removeu**. Se encontrar referência a `aprovacao-inputs.html`, é resíduo.
