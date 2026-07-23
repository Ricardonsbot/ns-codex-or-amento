# Passo a passo: publicar o projeto no GitHub e rodar com Docker

> **Para quem vai executar este documento (pessoa ou IA assistente):** siga os passos **na ordem**, um de cada vez. Cada passo tem um "Resultado esperado" — confirme que bate antes de ir para o próximo. Se algo não bater, pare e reporte exatamente qual passo falhou e a mensagem de erro completa, em vez de tentar pular a etapa.
>
> **Objetivo final:** o projeto (uma pasta chamada `Projeto - Estrutura`, um protótipo de app de orçamento em HTML/CSS/JS) precisa estar (1) publicado em um repositório no GitHub e (2) rodando localmente via Docker. No final, envie para o Emerson: a URL do repositório no GitHub e a confirmação de que `docker compose up` funcionou.

---

## 0. Pré-requisitos e contexto

- Este projeto **não tem** processo de build nem backend — é HTML/CSS/JS estático. Não é necessário instalar Node.js, npm, nem nada parecido.
- A pasta do projeto já é um repositório Git local (`git init` já foi executado e já existe 1 commit). Verifique isso antes de rodar `git init` de novo — **não rode `git init` se já existir uma pasta `.git`** dentro de `Projeto - Estrutura`.
- Sistema operacional alvo: Windows. Os comandos abaixo assumem PowerShell ou o terminal Git Bash (que já vem com o Git para Windows).

Verifique o que já está instalado antes de instalar de novo:

```powershell
git --version
docker --version
```

- Se `git --version` **falhar** (comando não encontrado): instale o Git em https://git-scm.com/download/win e reabra o terminal antes de continuar.
- Se `docker --version` **falhar**: siga o Passo 1 abaixo. Se já funcionar, pule para o Passo 2.

---

## 1. Instalar o Docker Desktop

1. Baixe em https://www.docker.com/products/docker-desktop/ e instale (ou rode no PowerShell: `winget install Docker.DockerDesktop`).
2. **Reinicie o computador** se o instalador pedir.
3. Abra o Docker Desktop manualmente uma vez pelo menu Iniciar. Aceite os termos de uso. Ele pode pedir para habilitar o WSL2 — aceite e siga as instruções na tela (pode pedir outro reinício).
4. Espere o ícone do Docker Desktop (baleia) na bandeja do sistema (canto inferior direito) mostrar que está "Running" (parado de animar / ícone fixo).

**Resultado esperado:** rodando `docker --version` no terminal aparece algo como `Docker version 27.x.x`. Rodando `docker run hello-world` deve baixar uma imagem de teste e imprimir uma mensagem começando com "Hello from Docker!".

---

## 2. Criar o repositório no GitHub

1. Entre em https://github.com/new (é necessário estar logado numa conta GitHub — se não tiver, crie uma gratuita em https://github.com/signup).
2. Preencha:
   - **Repository name:** `ns-codex-prototipo` (ou o nome que o Emerson pedir).
   - **Visibility:** Private (a menos que o Emerson diga o contrário).
   - **NÃO marque** nenhuma das opções "Add a README file", "Add .gitignore" ou "Choose a license" — o repositório precisa ser criado **vazio**, porque já existe conteúdo local para subir.
3. Clique em **Create repository**.
4. Na página que abrir, copie a URL que aparece em "…or push an existing repository from the command line". Ela se parece com:
   ```
   https://github.com/SEU-USUARIO/ns-codex-prototipo.git
   ```

**Resultado esperado:** você tem essa URL copiada. Ela será usada no próximo passo.

---

## 3. Conectar o repositório local ao GitHub e enviar (push)

Abra um terminal (PowerShell ou Git Bash) **dentro da pasta `Projeto - Estrutura`** (o caminho completo é algo como `...\Dev\Claude_Local\Projeto - Estrutura`).

```bash
cd "caminho/para/Projeto - Estrutura"

# confirme que já existe um repositório git com pelo menos 1 commit
git log --oneline
# deve mostrar 1 linha, algo como: 1f49c8e Commit inicial do protótipo NS Codex

# conecte ao repositório remoto (troque pela URL copiada no Passo 2)
git remote add origin https://github.com/SEU-USUARIO/ns-codex-prototipo.git

# envie o código
git push -u origin main
```

- Se pedir login: uma janela do navegador deve abrir pedindo para autorizar o Git/GitHub — faça o login normalmente ali.
- Se aparecer erro `remote origin already exists`, rode `git remote set-url origin https://github.com/SEU-USUARIO/ns-codex-prototipo.git` e tente o `git push` de novo.

**Resultado esperado:** o terminal mostra linhas de progresso de envio (`Writing objects... 100%`) e termina sem erro. Atualizando a página do repositório no GitHub (F5 no navegador), os arquivos do projeto devem aparecer lá.

---

## 4. Rodar o projeto com Docker

Ainda dentro da pasta `Projeto - Estrutura`:

```bash
docker compose up
```

Deixe esse terminal aberto (o processo fica "rodando" nele). Abra o navegador em:

```
http://localhost:8080
```

**Resultado esperado:** a tela de login do app ("NS Codex") aparece no navegador.

Para parar, volte ao terminal e aperte `Ctrl+C`, ou abra outro terminal na mesma pasta e rode `docker compose down`.

### Se a porta 8080 já estiver em uso

Erro do tipo `port is already allocated`: abra o arquivo `docker-compose.yml` nessa pasta, troque a linha `- "8080:80"` para outra porta livre, por exemplo `- "8081:80"`, salve, rode `docker compose up` de novo e acesse `http://localhost:8081`.

---

## 5. O que enviar de volta para o Emerson

Depois de completar os passos acima, envie:

1. A URL do repositório no GitHub (ex.: `https://github.com/SEU-USUARIO/ns-codex-prototipo`).
2. Confirmação de que `docker compose up` funcionou e a tela abriu em `http://localhost:8080` (um print de tela ajuda).
3. Se algum passo falhou e você não conseguiu resolver: qual passo, e a mensagem de erro completa (copiada do terminal, não resumida).
