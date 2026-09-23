# ---- Build stage: compila o app React (Vite) ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Chaves do Supabase precisam existir NO MOMENTO DO BUILD — o Vite embute
# essas variáveis no JS gerado, não são lidas em tempo de execução do container.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# ---- Serve stage: nginx sem root, para rodar em clusters que exigem
# containers non-root (Pod Security "restricted", a maioria dos clusters
# gerenciados hoje). A imagem "unprivileged" já escuta na 8080 e roda como
# uid 101 — sem isso o Kubernetes barraria o pod ou exigiria correr como
# root, o que muita política de segurança recusa.
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
