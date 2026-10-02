# infra — como o NS Codex roda

Portado da nsView (`nstechhub/nsview`), que resolve o mesmo problema em produção.
Ver [`../ARQUITETURA-NSVIEW.md`](../ARQUITETURA-NSVIEW.md) §2.7 para o porquê de
cada peça.

**Desenho:** uma VM. Postgres local, API .NET atrás do nginx, systemd segurando o
processo, `pg_dump` diário. Sem serviço gerenciado de terceiro — é o caminho que
a nsView já percorreu e que responde, por precedente, a pergunta de a onde o dado
financeiro pode morar.

```
navegador ──443──► nginx ──proxy──► 127.0.0.1:5055 (Kestrel/systemd) ──► Postgres local
                     │
                     └─ front estático em /var/www/ns-codex  (hoje DESLIGADO, ver abaixo)
```

## Os arquivos

| Arquivo | O que é |
|---|---|
| `scripts/provisionar-servidor.sh` | roda **uma vez**, como root. Runtime, conta de deploy, diretórios, banco, roles, schema, systemd, nginx |
| `scripts/deploy.sh` | roda a **cada release**, como a conta de deploy. Testa, publica, aplica schema, troca o binário, confere o `/health` |
| `scripts/aplicar-schema.sh` | aplica os `banco/*.sql` na ordem, uma vez cada. É o **gate de deploy** |
| `scripts/backup-postgres.sh` | `pg_dump -Fc` com retenção de 14 dias |
| `sql/roles.sql` | as três roles: dona, migrator, aplicação |
| `sql/forcar-rls.sql` | `FORCE ROW LEVEL SECURITY` — a segunda tranca |
| `scripts/conferir-rls.sh` | pergunta ao banco, com a credencial da **aplicação**, se a RLS está valendo |
| `systemd/*` | unit da API, serviço e timer do backup |
| `nginx/ns-codex.conf` | TLS, proxy do `/api/`, front estático |
| `env.example` | modelo do `.env` de produção |

## Ordem, num servidor novo

```bash
sudo infra/scripts/provisionar-servidor.sh    # imprime as senhas geradas
# escrever o DATABASE_URL impresso em /opt/ns-codex/api/.env (chmod 600)
# guardar o MIGRATOR_DATABASE_URL no ambiente de quem roda o deploy
bash infra/scripts/deploy.sh
curl -s https://SEU-HOST/health
```

## As três decisões que valem entender

**A aplicação não é dona das tabelas.** No Postgres o dono ignora Row Level
Security. Se a API conectasse como dona — ou como `postgres` — as políticas
seriam decoração e o `DELETE` de outra empresa voltaria a apagar. Daí as três
roles, e daí o `FORCE ROW LEVEL SECURITY`, que tira a exceção até da dona. O modo
de falha que isso cobre não é ataque: é um `DATABASE_URL` errado num deploy
apressado, que funciona e não avisa nada.

**O schema é aplicado antes de trocar o serviço.** O `deploy.sh` roda o
`aplicar-schema.sh` com a versão velha ainda no ar. Se falhar, aborta e a
produção segue servindo o que servia. Sem esse gate, uma migration ruim vira
crash-loop de boot — que foi o que aconteceu com a nsView em agosto.

**Schema aplicado é imutável.** O `aplicar-schema.sh` guarda o hash de cada
arquivo em `schema_versao`. Editar um `.sql` já aplicado faz o deploy parar com
`DIVERGENTE`, porque em produção o arquivo antigo não será reaplicado: editar não
muda nada lá, só cria divergência entre o que está no banco e o que está no
repositório. Alteração vira arquivo novo (`08-...`).

## ⚠ O front está desligado de propósito

`location /` devolve 404 e o `deploy.sh` só publica o estático com
`PUBLICAR_FRONT=1`. Não é excesso de zelo: `Referencias/clientes.json` tem 3.797
CNPJs com razão social e `assets/js/dados.js` carrega uma cópia embutida dos
mesmos dados. Como ainda não existe autenticação (passo 3 da ordem de ataque),
publicar o front é publicar a carteira para quem souber a URL.

Quando a autenticação entrar: descomentar o `try_files` no `nginx/ns-codex.conf`.
A negação de `/Referencias/` fica de pé mesmo assim — catálogo se lê por
`/api/ref/*`, que passa por autenticação.

## Restore

```bash
pg_restore -d nscodex --clean --no-owner /opt/ns-codex/backups/nscodex_<ts>.dump
```

`--no-owner` porque o dump é tirado com `--no-owner`: quem restaura vira dono, e
num servidor novo as roles podem ter nomes diferentes. **Depois do restore,
conferir se as tabelas voltaram para `nscodex_owner`** — se ficarem com a role da
aplicação, a RLS para de valer em silêncio.

Backup que nunca foi restaurado não é backup. Vale exercitar contra um banco
descartável antes de precisar.

## Verificado em 14/08/2026

Contra um Postgres 17 descartável, com o banco reconstruído do zero pelo
`aplicar-schema.sh` rodando como migrator:

```
dono das tabelas: nscodex_owner | 30
conferir-rls.sh:
  PASSA  catálogo acessível
  PASSA  sessão sem identidade não vê lançamento (0)
  PASSA  DDL negado para a aplicação
  PASSA  aplicação não é dona de nenhuma tabela (0)
  PASSA  FORCE ROW LEVEL SECURITY nas 3 tabelas (3)
```

E com a credencial da aplicação declarando quem age: operacional da Alfa enxerga
1 de 2 lançamentos, admin enxerga 2 de 2. Os 15 testes de comportamento da Fase 0
continuam passando.
