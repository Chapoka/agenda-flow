# EasyPanel - AgendaFlow
# Build recebe VITE_* via --build-arg (necessário pro Vite embedar no bundle)

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Args que o EasyPanel deve passar no build (Build Args)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
# Expõe como ENV pro vite build ler (import.meta.env)
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# --- Runtime ---
FROM node:22-alpine

WORKDIR /app

# deps de produção apenas
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY server ./server

# EasyPanel injeta PORT automaticamente. Default 3001 para local.
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/health || exit 1

CMD ["node", "server/index.js"]
