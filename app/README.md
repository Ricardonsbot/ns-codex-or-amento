# NS Codex — App React

Versão em migração do protótipo estático (pasta raiz do repositório) para um app React de verdade, conectado a um banco Postgres no [Supabase](https://supabase.com).

**Status:** Fase 1 — estrutura, rotas e layout compartilhado prontos. Telas migradas até agora: **Login** e **Dashboard**. As demais aparecem como "🚧 em construção" até serem migradas.

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Conectar ao Supabase

1. Crie uma conta gratuita em [supabase.com](https://supabase.com) e um novo projeto.
2. No projeto, vá em **SQL Editor → New query**, cole o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql) e clique em **Run**. Isso cria as tabelas.
3. Vá em **Settings → API** e copie a **Project URL** e a chave **anon public**.
4. Copie `.env.example` para `.env` e preencha:
   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon-public
   ```
5. Reinicie `npm run dev`.

O arquivo `.env` **nunca** deve ser commitado (já está no `.gitignore`) — ele é diferente pra cada pessoa/ambiente.

## Estrutura

```
src/
├── components/
│   ├── Layout.jsx         Sidebar + estrutura compartilhada entre as telas logadas
│   └── ToastProvider.jsx  Sistema de notificações (toast), equivalente ao showToast() do protótipo
├── lib/
│   └── supabaseClient.js  Cliente do Supabase, lido das variáveis de ambiente
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   └── EmConstrucao.jsx   Placeholder para telas ainda não migradas
├── App.jsx                 Definição das rotas
└── main.jsx                 Ponto de entrada (React Router + CSS global)
```

O `src/index.css` é uma cópia do `assets/css/style.css` do protótipo original — mesma paleta de cores e componentes visuais, sem depender de framework de CSS.
