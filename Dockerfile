# Build stage: gera o dist/ do Vite
FROM node:22-alpine AS builder

WORKDIR /app

# Variáveis do Supabase (Vite embute no build; defina no Easypanel > Ambiente / Build args)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# Runtime: serve estáticos com nginx + entrypoint que injeta env em runtime
FROM nginx:alpine

# SPA: todas as rotas caem no index.html
# Assets com hash no nome → cache imutável 1 ano
# index.html sem hash → sempre revalidar (garante deploy instantâneo)
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  location /assets/ { \
    expires 1y; \
    add_header Cache-Control "public, max-age=31536000, immutable"; \
  } \
  location / { \
    try_files $uri $uri/ /index.html; \
    add_header Cache-Control "no-cache, no-store, must-revalidate"; \
    add_header Pragma "no-cache"; \
  } \
  location /health { default_type text/plain; return 200 "ok"; } \
}' > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

# Entrypoint gera config.js a partir das variáveis de Ambiente do Easypanel e inicia nginx
CMD ["/docker-entrypoint.sh"]
