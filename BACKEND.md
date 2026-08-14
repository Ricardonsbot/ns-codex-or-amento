# Projeto do backend — do protótipo ao sistema

> Traçado em 13/08/2026 sobre o commit `9d487da`. Complementa o
> `BANCO-DE-DADOS.md`, que cobre só o banco. Aqui é a aplicação inteira:
> o que existe, o que falta, em que ordem, e o que pode dar errado.

---

## 1. De onde se parte

Três peças já existem e não se conversam:

| Peça | Estado | Onde |
|---|---|---|
| **Frontend** | 19 telas funcionando, HTML/CSS/JS puro, sem build | raiz + `assets/` |
| **Dados** | 18 JSON com o cadastro real (3.797 CNPJs, 425 contas, 104 CCs) | `Referencias/` |
| **Banco** | 30 tabelas em PostgreSQL, RLS, gatilhos — **nunca executado** | `banco/*.sql` |

O que **não** existe: aplicação de servidor, autenticação, persistência.
Nada do que o usuário digita sobrevive ao F5.

O `Dockerfile` atual é só nginx servindo estático. Não é o backend.

**A decisão que trava tudo** continua sendo a pendência nº 1 do `CONTEXTO.md`:
dado financeiro da NSTECH pode sair do tenant Microsoft? Sem essa resposta, a
Fase 1 abaixo pode ser feita num Postgres descartável local, mas a Fase 2 (carga
real) não deve começar.

---

## 2. A decisão de arquitetura

**API fina em FastAPI (Python), com a regra no banco.**

O schema já foi desenhado partindo do princípio de que **a permissão mora no
banco** (RLS) e a **auditoria é gatilho**, não chamada de rota. Isso muda o papel
do backend: ele não é onde a regra vive, é quem **diz ao banco quem está agindo**
e traduz HTTP em SQL.

```
navegador (as 19 telas, sem framework)
      │  fetch JSON
      ▼
FastAPI  ──►  a cada request: SET LOCAL app.pessoa_id / app.perfil
      │
      ▼
PostgreSQL  ──►  RLS decide o que a pessoa vê · gatilho grava a auditoria
                 gatilho barra versão fechada · CHECK barra pacote errado
```

**Por que FastAPI e não PostgREST/Supabase direto:** o `BANCO-DE-DADOS.md`
sugere expor REST gerenciado, e é mais barato — mas três coisas deste projeto
não cabem: login com sessão de verdade, o `SET LOCAL` por request (PostgREST usa
claims de JWT, exigiria refazer as políticas), e o ida-e-volta com Excel. Uma
camada fina resolve os três e não impede trocar depois.

**Por que Python:** os sete scripts de `ferramentas/` já leem `.xlsx`, `.xlsb` e
os templates. Viram a carga do banco quase de graça. Trocar de linguagem joga
esse trabalho fora.

### A regra que não pode ser quebrada

**O contrato de leitura da API é o formato dos JSON de hoje.**

`carregarRef()` lê 18 arquivos com um formato específico e as 19 telas dependem
dele. Se `GET /api/ref/contas.json` devolver **exatamente** o que
`Referencias/contas.json` devolve hoje, o front muda **uma linha** — a URL do
fetch — e passa a ler do banco. Toda tela que hoje funciona continua funcionando
no primeiro dia.

Sem isso, ligar as duas pontas vira reescrita do `app.js` de 5.829 linhas.

### O que não pode quebrar junto

O pacote de testes que está com o chefe **abre por duplo clique**, sem servidor.
O fallback `window.__DADOS_EMBUTIDOS` do `carregarRef()` tem de continuar
existindo: com API, o app é sistema; sem ela, volta a ser maquete. As duas vidas
convivem porque o fallback já está escrito.

---

## 3. As fases

### Fase 0 — Validar o schema (1–2 dias) · *não bloqueada pela TI*

Os 7 arquivos passam pelo parser mas nunca rodaram. Erro semântico — coluna com
nome errado, dependência fora de ordem — só aparece executando.

- [ ] Subir Postgres 13+ descartável (`docker compose`, banco `orcamento_dev`)
- [ ] Rodar os 7 arquivos com `-v ON_ERROR_STOP=1`, na ordem, e corrigir o que quebrar
- [ ] Executar o **Passo 5** do `BANCO-DE-DADOS.md`: o `DELETE` de outra empresa
      tem de afetar **0 linhas**. Se afetar, para tudo.
- [ ] Testar a trava de versão fechada e o gatilho de auditoria
- [ ] **Adotar migrations agora** (Alembic, já que é Python) — os 7 arquivos viram
      a migration inicial. Depois da primeira carga real, é tarde.

Entregável: banco que sobe do zero com um comando, e um teste que prova a RLS.

> **Resultado da Fase 0 — executada em 14/08/2026, PostgreSQL 17.10.**
> Os 7 arquivos rodaram do zero contra banco descartável: **108 comandos, exit 0
> em todos**, 30 tabelas, 3 views, 26 índices, 12 funções, 9 gatilhos, 5
> políticas, 2 papéis. Doze testes de comportamento passaram — RLS de leitura e
> de escrita, a tentativa de mover lançamento para fora do escopo, a porta dos
> fundos pelo `lancamento_mes`, regras PAC e DUP, auditoria por gatilho,
> append-only da trilha, trava de versão fechada e a recusa de reabertura.
> **Um defeito encontrado e corrigido** (`entrega` sem política de INSERT), mais
> dois pontos em aberto: ver "Achados da Fase 0" abaixo.

### Fase 1 — Carregar o cadastro real (3–5 dias) · *bloqueada pela TI*

Os scripts de `ferramentas/` hoje escrevem JSON. Passam a escrever no banco.

- [ ] `carrega_cadastro.py` → `bu` → `torre` → `sub_torre` → `empresa` → `centro_custo`,
      e `linha_pl` → `conta`, `pacote` → `pacote_categoria`, `produto` → `sub_produto`
- [ ] **De/para Torre → BU escrito à mão** (12 linhas) — não sai de planilha nenhuma
- [ ] Filtrar `IA_Status_Revisao` antes de tratar a organizacional como verdade
- [ ] Abrir o ciclo 2026 e a versão V1 (Passo 3 do `BANCO-DE-DADOS.md`)

Cuidado: o protótipo usa ~6% do cadastro real. Sair de 36 para 630 contas vai
expor as telas a combinações que nunca apareceram.

### Fase 2 — API de leitura, formato idêntico (1 semana)

- [ ] `GET /api/ref/{arquivo}` para os 18 JSON, **byte-compatível** com hoje
- [ ] Teste automático que compara a resposta da API com o arquivo em `Referencias/`
- [ ] `carregarRef()` ganha uma base configurável; sem API, cai no embutido

Neste ponto o app inteiro já lê do banco e nada visual mudou. É o marco que prova
que a arquitetura fecha.

### Fase 3 — Identidade (3–5 dias)

**Decidir antes de escrever a primeira linha:** `cadastro.pessoa` **não tem
coluna de senha**, e o comentário no `01-cadastro.sql` diz que é de propósito —
a autenticação deveria vir do SSO corporativo. Ou o SSO entra já na Fase 3
(e some o item de senha abaixo), ou a tabela ganha `senha_hash`. As duas são
defensáveis; decidir depois custa uma migration com pessoa cadastrada dentro.

- [ ] `POST /api/login` / `POST /api/logout`, sessão em cookie `HttpOnly`+`Secure`
- [ ] Se for senha local: hash forte e **troca obrigatória no primeiro acesso**
- [ ] Dependência do FastAPI que injeta, em toda transação:
      `SET LOCAL app.pessoa_id / app.pessoa_login / app.pessoa_nome / app.perfil`
- [ ] `SET LOCAL`, nunca `SET` — conexão de pool não pode vazar identidade
- [ ] `GET /api/eu` para a tela saber quem está logada

Se o `SET LOCAL` falhar, a request tem de **falhar**, não seguir sem identidade:
sem ele a RLS não filtra e a auditoria grava autoria vazia.

### Fase 4 — Escrita: o lançamento (2 semanas) · *o coração*

A grade é o caminho principal — chegam **centenas de linhas por vez**, não uma.

- [ ] `POST /api/lancamentos` em **lote**, transação única, tudo ou nada
- [ ] `ref` (uuid) gerado no servidor, estável, nunca reaproveitado nem regerado
- [ ] Valores em **reais com centavos** e `numeric` — a tela é quem mostra em R$ mil
- [ ] Uma linha por mês (`lancamento_mes`), doze colunas nunca
- [ ] As três categorias têm caminhos diferentes: Receita por contrato/CNPJ,
      Despesa por conta/CC/motivo/ativação, Capex por projeto/tipo de ativo
- [ ] Erro de validação volta **por linha**, com o índice — a grade precisa
      pintar a célula certa
- [ ] Importar/exportar `.xlsx` casando pelo `ref`: 800 linhas exportadas, 3
      editadas, sobe de volta e atualiza 3 em vez de duplicar 800

O CHECK de categoria já existe no banco (`pacote_serve_categoria`); a API não
reimplementa, deixa estourar e traduz a mensagem.

### Fase 5 — Fluxo (1–2 semanas)

Entregas, submissão, as 6 regras de validação, aprovação, correções, aceite
final. As tabelas existem (`04-fluxo.sql`), inclusive o gatilho que impede
aprovar com bloqueio aberto e o que exige aprovação antes do aceite.

- [ ] `GET/POST /api/entregas`, `/api/submissoes`, `/api/aprovacoes`, `/api/correcoes`
- [ ] `GET /api/auditoria` com filtro — a trilha já é gravada por gatilho
- [ ] Notificações: começar por leitura em tela; e-mail é escopo separado

### Fase 6 — Realizado e análise (1–2 semanas)

- [ ] `POST /api/cargas` (realizado do ERP) → tabela `valor`, separada do orçado
- [ ] `GET /api/orcado-vs-realizado` sobre a view que já existe
- [ ] Justificativas de desvio
- [ ] Roadmap 17 (copiar orçamento anterior) e 23 (simulação) entram aqui

### Fase 7 — Operação (contínuo)

- [ ] Backup automático + **restore testado** (backup não testado não é backup)
- [ ] Migrations no deploy, nunca `.sql` na mão em produção
- [ ] Log estruturado, healthcheck, alerta de erro 500
- [ ] Segredos fora do repo

---

## 4. Endpoints — mapa por tela

| Tela | Lê | Escreve |
|---|---|---|
| `orcamento-receita/despesa/capex` | `/api/ref/*`, `/api/lancamentos` | `POST /api/lancamentos` (lote) |
| `importar` | `/api/ref/*` | `POST /api/lancamentos/importar` |
| `entregas` | `/api/entregas` | `POST /api/entregas/{id}/submeter` |
| `aprovacoes` | `/api/submissoes` | `POST /api/submissoes/{id}/aprovar` e `/rejeitar` |
| `correcoes` | `/api/submissoes?status=rejeitada` | `POST /api/lancamentos/{ref}` |
| `auditoria` | `/api/auditoria` | — (append-only por gatilho) |
| `relatorios`, `dashboard-executivo` | `/api/relatorios/*` | — |
| `usuarios` | `/api/pessoas` | `POST /api/pessoas` |
| `indices`, `budget-settings` | `/api/ref/*`, `/api/versoes` | `POST /api/versoes/{id}/fechar` |

O `.xlsx` e o `.pptx` continuam sendo gerados **no navegador**, à mão. Já
funcionam, não dependem de rede e tiram carga do servidor. Não mover para o
backend sem motivo.

---

## 4b. Achados da Fase 0

### `entrega` não aceitava INSERT de ninguém — **corrigido**

`07-permissoes.sql` ligava RLS em `entrega` com duas políticas — `entrega_le`
(`FOR SELECT`) e `entrega_escreve` (`FOR UPDATE`) — e **nenhuma de INSERT**. Com
RLS ligada, o que nenhuma política permite é proibido: o `GRANT INSERT` não
produzia efeito e nenhuma entrega podia ser criada pela aplicação.

Não aparece no parser nem na conferência cruzada — é a classe de erro que só a
execução mostra, e só machucaria na Fase 5, com o fluxo já meio escrito.

Decisão tomada: **quem abre a entrega é o admin**, no começo do ciclo; o
responsável recebe uma entrega, não cria a sua. A política nova:

```sql
CREATE POLICY entrega_cria ON entrega
    FOR INSERT
    WITH CHECK (app_perfil() = 'admin');
```

Verificado com o banco reconstruído do zero: admin cria (1 linha), operacional é
recusado pela política, e o responsável continua atualizando a entrega dele.

### Ainda em aberto: `submissao`, `submissao_validacao` e `aceite_final`

As três têm `GRANT INSERT` e estão **sem RLS ligada**. Ou falta proteção nelas,
ou sobra em `entrega`. As duas leituras são plausíveis e a escolha é de projeto,
não de correção mecânica — decidir junto com a Fase 5.

### Os papéis são do cluster, não do banco

Recriar o banco descartável e rodar os 7 arquivos de novo **falha no `07`**:
`CREATE ROLE app_leitura` estoura porque papel é objeto do cluster e sobrevive ao
`dropdb`. Para repetir a carga do zero é preciso `DROP ROLE` antes — vale como
nota no procedimento, e some quando os arquivos virarem migration.

---

## 5. Riscos, na ordem em que machucam

1. **A decisão da TI não vem.** É a pendência nº 1 e trava da Fase 1 em diante.
   Agravante já registrado: os 3.797 CNPJs e 20 MB de planilha **já estão no
   GitHub** — desfazer exige reescrever histórico. Vale levar isso junto com a
   pergunta.
2. **O schema não roda de primeira.** Provável e barato — por isso é a Fase 0.
3. **O cadastro real quebra as telas.** 6% → 100% dos dados. Mitigação: a Fase 2
   troca a fonte sem mudar o formato, então o problema aparece isolado.
4. **A grade fica lenta.** Centenas de linhas com fetch por linha não fecha.
   Por isso lote e transação única desde o primeiro dia.
5. **Duas verdades.** Se o realizado for editável na ferramenta, ela vira um ERP
   concorrente. Realizado é carga, nunca digitação.
6. **O pacote-motivo.** Pendência nº 2: ou vira disciplina nova no lançamento, ou
   a coluna sai. Decidir **antes** da Fase 4 — depois é migration com dado dentro.

---

## 6. Ordem de ataque sugerida

1. **Fase 0 inteira** — não depende de ninguém e é a que descobre erro caro cedo
2. **Levar a pergunta da TI** com o agravante do GitHub junto
3. **Fase 2 (leitura) contra o banco de desenvolvimento**, com cadastro parcial —
   prova a arquitetura antes de qualquer dado real entrar

Estimativa até a Fase 4 fechada (sistema que guarda o que a pessoa lança):
**6 a 8 semanas** de trabalho focado, contando a espera da TI como paralela.
