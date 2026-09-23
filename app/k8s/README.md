# NS Budget — Kubernetes

Manifests para rodar o app em cluster. O container é só **nginx servindo
arquivos estáticos** — não há backend próprio: quem fala com o banco é o
navegador de quem está usando, direto no Supabase.

## O que isso muda no deploy

**As chaves do Supabase (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) vão
dentro da imagem, no momento do `docker build`** — o Vite embute essas
variáveis no JavaScript gerado, elas não são lidas em tempo de execução do
container. Por isso:

- Não adianta criar um `ConfigMap`/`Secret` e injetar como variável de
  ambiente no Pod — o nginx nunca lê isso, o valor já está compilado no `.js`.
- Se o time inteiro usa o **mesmo** projeto Supabase (é o caso hoje — ver
  `../README.md`), **uma imagem só** serve para todos os ambientes.
- Se um dia existir um Supabase diferente por ambiente (dev/staging/prod),
  aí sim precisa de uma imagem por ambiente, cada uma buildada com os
  `--build-arg` do seu próprio Supabase.

## 1. Build e push da imagem

```bash
cd app
docker build \
  --build-arg VITE_SUPABASE_URL=https://aaiicgcxivjlxsbcfkmn.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=sb_publishable_... \
  -t SEU_REGISTRY/ns-budget:latest .

docker push SEU_REGISTRY/ns-budget:latest
```

Troque `SEU_REGISTRY` pelo registry da sua infra (ECR, GCR, Harbor, Docker
Hub privado...). Se o cluster não tiver acesso público ao registry, configure
um `imagePullSecrets` no Deployment ou no ServiceAccount do namespace.

## 2. Ajustar os manifests antes de aplicar

- `deployment.yaml` — troque `image: SEU_REGISTRY/ns-budget:latest` pela
  imagem que você acabou de publicar.
- `ingress.yaml` — troque `budget.SEUDOMINIO.com.br` pelo domínio real, e as
  anotações pelas do seu ingress controller (os exemplos são para
  ingress-nginx + cert-manager).

## 3. Aplicar no cluster

Com kustomize (recomendado — aplica os 4 recursos com o namespace certo):

```bash
kubectl apply -k k8s/
```

Ou arquivo a arquivo, sem kustomize:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/deployment.yaml -n ns-budget
kubectl apply -f k8s/service.yaml -n ns-budget
kubectl apply -f k8s/ingress.yaml -n ns-budget
kubectl apply -f k8s/hpa.yaml -n ns-budget
```

## O que está incluso, e por quê

| Recurso | O que faz |
|---|---|
| `namespace.yaml` | Isola o app (`ns-budget`) do resto do cluster. |
| `deployment.yaml` | 2 réplicas, `securityContext` non-root/read-only (a maioria dos clusters gerenciados hoje exige isso — Pod Security "restricted"), probes de liveness/readiness batendo em `/healthz`, requests/limits pequenos (é HTML/CSS/JS estático). |
| `service.yaml` | ClusterIP interno — quem expõe pra fora é o Ingress. |
| `ingress.yaml` | Roteamento HTTP(S) + TLS via cert-manager. Ajuste para o seu ingress controller se não for nginx-ingress. |
| `hpa.yaml` | Escala de 2 a 5 réplicas por CPU — opcional, apague se o cluster não tiver metrics-server. |

## Rodar/testar localmente antes de ir pro cluster

```bash
cd app
docker compose up --build
```

Abre em `http://localhost:8090` — mesma imagem, sem Kubernetes. Útil para
confirmar que o build passou antes de subir pro registry.
