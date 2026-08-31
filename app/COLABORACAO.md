# Como colaborar neste projeto

Este app roda contra um projeto Supabase compartilhado (mesmo banco pra todo mundo) e o código
fica sincronizado via Git, na branch `ns-budget-react-supabase` do repositório
[Ricardonsbot/ns-codex-or-amento](https://github.com/Ricardonsbot/ns-codex-or-amento).

## Antes de começar a mexer

```bash
git pull origin ns-budget-react-supabase
```

## Depois de terminar uma mudança

Não deixe acumular vários dias de trabalho sem enviar — commits pequenos e frequentes evitam
conflito.

```bash
git add .
git commit -m "descrição do que mudou"
git push origin ns-budget-react-supabase
```

## Se der conflito

Acontece se dois de nós editarmos exatamente o mesmo trecho do mesmo arquivo sem puxar
(`git pull`) antes. O Git marca no próprio arquivo os dois trechos divergentes — resolva
manualmente escolhendo/combinando o que fica, depois `git add` + `git commit` normalmente.
Como cada tela do app é seu próprio arquivo (`src/pages/...`), isso raramente deve acontecer
se cada um avisar qual tela está mexendo.

## Banco de dados (Supabase)

O banco é compartilhado — qualquer alteração de **estrutura** (criar/alterar tabela via SQL
Editor) afeta todo mundo na hora. Avise antes de rodar SQL que muda schema. Alterações de
**dados** (usar o app normalmente) não precisam de aviso.

Configuração local (`app/.env`, nunca commitado): peça a URL e a chave do projeto Supabase pra
quem já tem, e veja o [README.md](./README.md#conectar-ao-supabase) pra instruções completas.
