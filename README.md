# NS Codex — Protótipo de Orçamento Corporativo

Protótipo visual (front-end estático: HTML, CSS e JavaScript puro, sem framework e sem backend) do app de orçamento corporativo da NSTECH. Cobre Receita, Despesa e Capex, organizado pela hierarquia **BU → Torre → Sub Torre → Empresa**, com telas de Dashboard, Relatórios, Aprovações, Cadastros (Layouts, Índices, Usuários etc.) e Budget - Settings.

> ⚠️ Isso é um **protótipo**: os botões simulam ações (toast, mudança de status) mas nada é salvo de verdade. Não há banco de dados nem servidor de aplicação.

## Como rodar o projeto

Existem duas formas. Se você tem Docker instalado, use a primeira — é a que garante que todo mundo (você e o desenvolvedor) vê exatamente a mesma coisa.

### Opção 1 — Com Docker (recomendado)

Pré-requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e aberto.

```bash
docker compose up
```

Depois abra **http://localhost:8080** no navegador.

Para parar: `Ctrl+C` no terminal, ou `docker compose down`.

Como o `docker-compose.yml` monta a pasta do projeto dentro do container (`volumes`), qualquer alteração que você ou o desenvolvedor fizerem nos arquivos `.html`/`.css`/`.js` aparece só dando **refresh no navegador** — não precisa reiniciar o Docker.

### Opção 2 — Sem Docker (Python)

Se preferir não instalar Docker agora, com Python instalado:

```bash
python -m http.server 8080
```

Depois abra **http://localhost:8080**.

## Estrutura do projeto

```
Projeto - Estrutura/
├── index.html              Dashboard (tela principal pós-login)
├── login.html               Tela de login
├── orcamento-receita.html    Lançamento de Receita — (+) Revenue
├── orcamento-despesa.html    Lançamento de Despesa — (−) Expenses
├── orcamento-capex.html      Lançamento de Capex — (−) Capex (ainda em construção)
├── relatorios.html           Relatórios (abas Geral / Torres / P&L)
├── aprovacoes.html           Fluxo de aprovação (em construção)
├── usuarios.html             Cadastros (hub administrativo)
├── layouts.html              Cadastro de Layouts (Campos, Layout P&L, Layout Torres)
├── indices.html              Cadastro de Índices de reajuste (IGP-M, INPC, IPCA...)
├── budget-settings.html       Ciclos & Versões do orçamento
├── lancamento.html            Tela de contexto (BU/Torre/Empresa) antes do lançamento
├── visualizar-budget.html     Seleção de BU para visualização
├── assets/
│   ├── css/style.css          Todo o CSS do app (compartilhado entre as páginas)
│   └── js/app.js              Todo o JS do app (ações simuladas, tabs, autocomplete etc.)
├── Referencias/                Dados SIMULADOS de referência (plano de contas e estrutura organizacional)
│   ├── contas.json             Usado no autocomplete de "Conta" nas grades
│   └── organizacional.json     Usado no autocomplete de "Centro de Custo"
├── Dockerfile
└── docker-compose.yml
```

Não existe processo de build — é só abrir os arquivos `.html` (servidos por um servidor estático, Docker ou Python) e editar `.css`/`.js` diretamente.

## Como editar

1. Abra a pasta no VS Code (ou o editor de preferência).
2. Edite o `.html` da tela que quiser mudar, o `assets/css/style.css` (estilos) ou o `assets/js/app.js` (comportamento).
3. Salve e dê refresh no navegador — não tem passo de compilação.

## Fluxo de trabalho com Git/GitHub (para você e o desenvolvedor)

Depois que o repositório estiver no GitHub:

```bash
# clonar o repositório (primeira vez, cada um na sua máquina)
git clone <URL-do-repositorio>
cd "Projeto - Estrutura"

# criar uma branch para uma mudança
git checkout -b minha-mudanca

# depois de editar os arquivos:
git add .
git commit -m "Descrição curta da mudança"
git push origin minha-mudanca
```

Depois é só abrir um **Pull Request** no GitHub para revisar e juntar (merge) as mudanças na branch principal (`main`).
