# Estruturar o banco em PostgreSQL — passo a passo

Guia para sair do protótipo (JSON estático, nada é gravado) para um banco de
verdade que guarde o que as pessoas lançam.

Os arquivos `.sql` em `banco/` são para rodar na ordem. Cada um resolve uma
parte e explica, em comentário, **por que** foi feito daquele jeito — que é a
informação que se perde primeiro.

---

## Antes de tudo: o tamanho do problema

| | Por versão | Por ano (4 versões) | Em 5 anos |
|---|---|---|---|
| Cenário mediano | ~9.800 | ~39 mil | **~195 mil linhas** |
| Cenário médio | ~30.000 | ~121 mil | **~604 mil linhas** |

Meio milhão de linhas em cinco anos. **Escala não é o seu problema** — isso cabe
num SQLite. A escolha do Postgres se justifica por outras três coisas:

1. **A permissão mora no banco** (Row Level Security), não no código da tela.
2. **Regras de negócio viram restrição**, não convenção que alguém pode esquecer.
3. **Sobrevive a você**: backup, réplica e acesso são problema de infraestrutura,
   não de uma pessoa.

O item 1 não é teórico. Na versão Flask deste mesmo domínio, a regra "só mexe na
própria empresa" estava nas rotas — e três rotas de exclusão esqueceram dela.
Qualquer usuário logado apagava lançamento de qualquer empresa.

---

## Passo 0 — Decidir onde o banco vai morar

**Esta é a única decisão que não é técnica, e ela bloqueia o resto.**

A pergunta para a sua TI: *dado financeiro da NSTECH pode ir para um serviço
fora do tenant Microsoft?*

- **Pode** → Postgres gerenciado (Supabase, Neon, Railway, RDS). Backup,
  atualização e réplica ficam com o fornecedor.
- **Não pode** → Postgres dentro da infraestrutura da NSTECH, ou repensar para
  a stack Microsoft (Dataverse / SQL Azure). O schema aqui continua valendo
  quase inteiro; muda quem opera.

Não comece a carregar dado antes desta resposta. Migrar depois é caro.

**Versão mínima: PostgreSQL 13.** Abaixo disso, `gen_random_uuid()` exige a
extensão `pgcrypto`.

---

## Passo 1 — Criar o banco e rodar os arquivos

```bash
createdb orcamento_nstech

psql -d orcamento_nstech -v ON_ERROR_STOP=1 -f banco/01-cadastro.sql
psql -d orcamento_nstech -v ON_ERROR_STOP=1 -f banco/02-ciclos-e-versoes.sql
psql -d orcamento_nstech -v ON_ERROR_STOP=1 -f banco/03-lancamentos.sql
psql -d orcamento_nstech -v ON_ERROR_STOP=1 -f banco/04-fluxo.sql
psql -d orcamento_nstech -v ON_ERROR_STOP=1 -f banco/05-auditoria.sql
psql -d orcamento_nstech -v ON_ERROR_STOP=1 -f banco/06-realizado.sql
psql -d orcamento_nstech -v ON_ERROR_STOP=1 -f banco/07-permissoes.sql
```

O `-v ON_ERROR_STOP=1` é importante: sem ele o psql segue em frente depois de um
erro e você termina com um banco pela metade achando que deu certo.

O passo 07 cria papéis (`CREATE ROLE`), o que exige superusuário.

**A ordem importa** — cada arquivo referencia o anterior:

| Arquivo | O que resolve |
|---|---|
| `01-cadastro` | BU, Torre, Sub Torre, Empresa, Centro de Custo, plano de contas, pacotes, produtos, premissas, pessoas |
| `02-ciclos-e-versoes` | Ciclo, versão e a trava que torna versão fechada imutável |
| `03-lancamentos` | O lançamento e seus 12 meses; as regras PAC e DUP viradas restrição |
| `04-fluxo` | Entregas, submissão, as 6 regras de validação, aceite final do líder |
| `05-auditoria` | Trilha append-only, gravada por gatilho |
| `06-realizado` | Carga do ERP e a visão orçado vs. realizado |
| `07-permissoes` | Row Level Security |

---

## Passo 2 — Carregar o cadastro

**Os dados reais já estão neste repositório**, e o protótipo usa uma fatia de
~6% deles:

| Fonte | Conteúdo real | O que o protótipo usa hoje |
|---|---|---|
| `Referencias/tbl_KMM_Contas.xlsx` | 630 contas, 31 linhas de P&L | 36 contas |
| `Referencias/tbl_KMM_Organizacional.xlsx` | 3.245 linhas, 48 empresas, 176 centros de custo | 37 linhas, 35 empresas |

Ordem de carga (respeitando as chaves estrangeiras): `bu` → `torre` →
`sub_torre` → `empresa` → `centro_custo`, e em paralelo `linha_pl` → `conta`,
`pacote` → `pacote_categoria`, `produto` → `sub_produto`.

**Uma coisa não sai dos arquivos: a BU.** A coluna `Nstech_BUConsolidado` só tem
quatro valores de *nível* ("NA", "BU", "Consolidado", "Nstech"), não o nome da
BU. A Torre sai de `Nstech_DeParaEmpresa25`, mas o de/para Torre → BU precisa ser
escrito à mão. São 12 torres: uma tabela de 12 linhas, não um projeto — mas é
uma decisão de negócio, não de engenharia.

**Cuidado com a qualidade:** a tabela organizacional tem colunas `IA_Confianca`,
`IA_Status_Revisao` e `IA_Inserido_Por`. Parte daquelas 3.245 linhas foi
preenchida por um processo de IA e tem fluxo de revisão. Filtre por esse status
antes de tratar a tabela como verdade.

---

## Passo 3 — Abrir o primeiro ciclo

```sql
INSERT INTO orcamento.ciclo (ano, nome) VALUES (2026, 'Budget 2026');

INSERT INTO orcamento.versao (ciclo_id, codigo, nome, tipo, status, aberta_em)
SELECT id, 'V1', 'Budget 2026 — V1', 'budget', 'aberta', now()
  FROM orcamento.ciclo WHERE ano = 2026;
```

A partir daqui o banco só aceita lançamento nessa versão. Quando ela fechar,
nenhuma linha dela muda mais — nem por dentro da aplicação, nem por psql.

---

## Passo 4 — Ligar a aplicação

Logo depois de conectar, **toda sessão precisa dizer quem está agindo**:

```sql
SET LOCAL app.pessoa_id    = '42';
SET LOCAL app.pessoa_login = 'ana.ribeiro';
SET LOCAL app.pessoa_nome  = 'Ana Ribeiro';
SET LOCAL app.perfil       = 'operacional';
```

É disso que dependem duas coisas: o Row Level Security sabe o que a pessoa pode
ver, e a auditoria grava a autoria **sozinha**, por gatilho, sem a aplicação
precisar lembrar de chamar nada. Foi assim que o registro de auditoria deixou de
depender de disciplina de quem escreve a rota.

`SET LOCAL` e não `SET`: vale só até o fim da transação, então uma conexão
reaproveitada de um pool não vaza a identidade de um usuário para o próximo.

---

## Passo 5 — Conferir que a permissão está valendo

Este é o teste que a versão anterior não passaria:

```sql
SET ROLE app_escrita;
SET LOCAL app.pessoa_id = '42';
SET LOCAL app.perfil    = 'operacional';

SELECT count(*) FROM orcamento.lancamento;               -- só as empresas dele
DELETE FROM orcamento.lancamento WHERE empresa_id = 99;  -- 0 linhas afetadas
```

O correto é **não enxergar**, não "dar erro de permissão". Se esse `DELETE`
afetar alguma linha, a política não está ativa — pare e investigue antes de
carregar qualquer dado real.

Vale testar também a trava de versão:

```sql
UPDATE orcamento.versao SET status = 'fechada' WHERE codigo = 'V1';
-- agora qualquer INSERT em lancamento deve falhar com "Versão está fechada"
```

---

## As cinco decisões que estão embutidas no schema

Se você só ler uma seção deste documento, leia esta. São escolhas caras de
reverter depois.

**1. Uma linha por mês, nunca doze colunas.** É tentador guardar `jan..dez` como
colunas porque parece com a planilha. Aí não dá para filtrar por período sem
doze condições, somar um trimestre vira soma manual, e incluir 2027 vira
alteração de estrutura.

**2. Versão fechada é imutável.** Revisão é cópia nova, não edição do original.
É o que permite comparar V1 contra revisão e o que impede alguém de reescrever
um número já aprovado. Sem isso, "orçado vs. realizado" não tem contra o que
comparar. A trava é gatilho no banco, não regra da tela.

**3. Cada lançamento tem um `ref` (uuid) estável.** É o que faz o ida-e-volta com
Excel funcionar: a pessoa exporta 800 linhas, edita 3, sobe de volta, e o
sistema sabe o que atualizar em vez de duplicar. Nunca reaproveitar nem regerar.

**4. Valores em reais, com centavos — não em R$ mil.** A tela mostra em mil;
quem converte é a tela. Guardar "em mil" no banco é como se perdem 40 mil reais
num arredondamento seis meses depois. E `numeric`, nunca `float`.

**5. Realizado em tabela separada do orçado.** Orçado é compromisso de alguém;
realizado é fato do ERP. Procedências e confianças diferentes. Juntar os dois com
uma coluna "tipo" é como você deixa de saber o que era plano e o que era fato — e
como a ferramenta vira uma segunda verdade concorrendo com o ERP.

---

## O que este schema ainda não resolve

Honestidade sobre os limites:

- **O de/para Torre → BU não existe** e precisa de decisão de negócio (passo 2).
- **O pacote NOV (Novos Contratos) está órfão.** Quando o Pacote saiu da Receita,
  o conceito "contrato fechado que ainda não está na base" ficou sem lugar, e não
  é coberto por nenhum dos quatro Tipos de Receita. Ver `Referencias/pacotes.json`.
- **Não há migrations.** Os arquivos criam do zero. Para evoluir o schema depois,
  adote uma ferramenta (Flyway, Alembic, sqitch) antes da primeira carga real —
  não depois.
- **Não há tela.** O protótipo continua lendo `Referencias/*.json`. Ligar as duas
  pontas é o passo seguinte, e a forma mais barata é o Postgres gerenciado expor
  uma API REST que o front consome direto.
- **A regra VAR (variação vs. ano anterior até 30%) não está implementada** como
  restrição, porque depende de ter o ciclo anterior carregado.

---

## Estado de validação

Os sete arquivos passam pelo parser oficial do PostgreSQL (`libpg_query`, via
`pglast`): **108 comandos, zero erro de sintaxe**.

Isso valida a *sintaxe*, não a execução. Erros semânticos — uma coluna referida
com o nome errado, uma dependência entre arquivos fora de ordem — só aparecem
rodando de verdade. **Rode contra um banco descartável antes de rodar contra o
que vale.**
