# Deploy AgendaFlow — EasyPanel + Supabase + GitHub + VS Code

Guia 100% prático para subir o app em produção. Já está pré-configurado, só seguir os passos.

---

## 1. Arquitetura

```
GitHub (Chapoka/agenda-flow:main)
   ↓ (EasyPanel faz git pull + docker build)
EasyPanel Host: fpczjb.easypanel.host
   ├── agendaflow-supabase  → Supabase self-hosted (Postgres, Auth, Kong, Storage)
   │     URL pública: https://agendaflow-supabase.fpczjb.easypanel.host
   │     Rede interna: http://agendaflow-supabase-kong:8000
   └── agendaflow-app       → Node 22 + Express + Vite build
         Porta: 3001 (EasyPanel injeta $PORT)
         Health: GET /api/health
```

**Variáveis críticas:**
- `Dockerfile:6-18` — `ARG VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY` precisam ser passados no BUILD (Vite embeda no bundle).
- `docker-compose.yml:6-19` — `SUPABASE_INTERNAL_URL=http://agendaflow-supabase-kong:8000` (backend valida token sem sair pra internet).
- `server/index.js:38-65` — middleware auth usa `SUPABASE_SERVICE_ROLE_KEY`.
- `supabase/.env.easypanel.ready:1-40` — arquivo pronto para colar no EasyPanel Supabase.

---

## 2. VS Code — Abrir e configurar (1 min)

1. Abra a pasta `AgendaFlow` no VS Code.
2. Instale extensões recomendadas: `Ctrl+Shift+P` → `Extensions: Show Recommended Extensions` → Install All
   - Lista em `.vscode/extensions.json:2-12` (Prettier, ESLint, Tailwind, GitLens)
3. Verifique tasks: `Ctrl+Shift+P` → `Tasks: Run Task` → você deve ver:
   - `dev` (concurrent server+vite) — `.vscode/tasks.json:5`
   - `build` / `lint`
   - `supabase: link` / `supabase: push migrations`
   - `docker: build (EasyPanel test)`
   - `git: push + deploy`
4. `.vscode/settings.json:1-53` já ativa formatOnSave + ESLint fix.
5. Faça login no GitHub dentro do VS Code: Accounts (canto inferior) → Sign in with GitHub.

Teste local:
```powershell
npm ci
npm run dev
# abre http://localhost:5173  (vite) + http://localhost:3001/api/health
```

---

## 3. GitHub — Já configurado

Repo: `https://github.com/Chapoka/agenda-flow` (branch `main`) — `git remote -v` OK

**Secrets já configurados via `gh secret` (2026-09-16):**
```bash
gh secret list --repo Chapoka/agenda-flow
# VITE_SUPABASE_URL → https://agendaflow-supabase.fpczjb.easypanel.host
# VITE_SUPABASE_ANON_KEY → eyJhbGciOi...
```
Workflows em `.github/workflows/`:
- `ci.yml:1-28` — build + lint a cada push em `main`
- `docker.yml:1-34` — testa `docker build` + `docker run` + `/api/health`

Para subir código (VS Code ou terminal):
```powershell
git add .
git commit -m "feat: ..."
git push origin main
# ou no VS Code: Tasks → git: push + deploy
```
Acompanhe em: https://github.com/Chapoka/agenda-flow/actions

Para adicionar novo secret:
```powershell
"valor" | gh secret set NOME --repo Chapoka/agenda-flow
```

---

## 4. Supabase (EasyPanel self-hosted)

### 4.1 Criar serviço Supabase no EasyPanel

EasyPanel → **Create Service** → **Supabase** (template oficial) → nome `agendaflow-supabase`

- Em **Environment**, cole **INTEIRO** o conteúdo de `supabase/.env.easypanel.ready:1-170`
  - Contém: `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `SUPABASE_PUBLIC_URL=https://agendaflow-supabase.fpczjb.easypanel.host`, `SITE_URL`, SMTP Resend etc.
  - **ATENÇÃO:** Se já tem um serviço `agendaflow-supabase` rodando, NÃO troque `JWT_SECRET` depois — invalidaria `ANON_KEY/SERVICE_ROLE_KEY` e `.env.local`.

- Em **Domains**, crie:
  - `agendaflow-supabase.fpczjb.easypanel.host` → porta `8000` (Kong) — API pública
  - Opcional: `agendaflow-studio.fpczjb.easypanel.host` → porta `3000` (Studio)

- Deploy → aguarde ficar `Running` (Kong, Postgres, Auth, Storage).

### 4.2 Bootstrap do banco (primeira vez)

No Studio (`https://agendaflow-supabase.fpczjb.easypanel.host` ou porta 3000) → **SQL Editor** → cole **INTEIRO** `supabase/agendaflow_bootstrap.sql:1-553` e **Run**.

Isso cria:
- Tabelas: `companies`, `users`, `customers`, `appointments`, `services`, `plans`, `stylist_levels`, etc.
- Funções: `is_super_admin()`, `get_user_company_ids()`, trigger `handle_new_user()`
- RLS policies + `establishment_types` seed.

Valide:
```sql
select table_name from information_schema.tables where table_schema='public' order by 1;
-- deve listar 20+ tabelas
select * from establishment_types;
```

### 4.3 Migrations incrementais

Para mudanças futuras, as migrations estão em `supabase/migrations/` (30 arquivos). Se usou bootstrap, já estão aplicadas. Para aplicar novas:
```powershell
# via VS Code Task: supabase: push migrations
# ou manual:
npx supabase link --project-ref <id>  # só se usar Supabase Cloud; para self-hosted use SQL Editor
```

### 4.4 SMTP / Auth

Em `supabase/.env.easypanel.ready:101-108` já está Resend:
```
SMTP_HOST=smtp.resend.com
SMTP_USER=resend
SMTP_PASS=re_xxx
SITE_URL=https://agendaflow-supabase.fpczjb.easypanel.host
```
Para trocar, edite no EasyPanel → Environment e Redeploy.

---

## 5. EasyPanel — App AgendaFlow

### 5.1 Criar serviço App

EasyPanel → **Create Service** → **App** → nome `agendaflow-app`

**Source:**
- Provider: **GitHub** → conecte conta `Chapoka` → repo `agenda-flow` → branch `main`
- Build Method: **Dockerfile** → `Dockerfile` na raiz
- **Build Args** (OBRIGATÓRIO — Vite precisa no build):
  ```
  VITE_SUPABASE_URL=https://agendaflow-supabase.fpczjb.easypanel.host
  VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg5NDI2NjYyLCJleHAiOjIxMDQ3ODY2NjJ9.H4KpdkekK6ebP_jD8Imq2D-ucnKAmr1dwFdjXs6-B78
  ```
  > Copie exatamente de `.env.local:1-2` ou `supabase/.env.easypanel.ready:12-13`. Sem isso o frontend builda com `placeholder` e não conecta.

**Environment (Runtime):**
```
NODE_ENV=production
PORT=3001
SUPABASE_INTERNAL_URL=http://agendaflow-supabase-kong:8000
VITE_SUPABASE_URL=https://agendaflow-supabase.fpczjb.easypanel.host
VITE_SUPABASE_ANON_KEY=eyJhbGciOi... (mesmo acima)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODk0MjY2NjIsImV4cCI6MjEwNDc4NjY2Mn0.30e-0P3jTceOdUUzgoOew2O2jBR0jmOfmUawbWYsSjY
# Opcional:
CPF_API_KEY=
```
> `SUPABASE_SERVICE_ROLE_KEY` está em `supabase/.env.easypanel.ready:13` — **NUNCA** exponha no frontend, só no EasyPanel Env.

**Domains:**
- `agendaflow.fpczjb.easypanel.host` (ou seu domínio) → porta `3001`

**Deploy:**
- Auto Deploy: **ON** (deploy a cada `git push main`)
- Health Check: `GET /api/health` → espera 200 (já configurado em `Dockerfile:39-40`)

Clique **Deploy** → acompanhe Logs. Sucesso = `Server running on port 3001`.

### 5.2 Teste pós-deploy
```bash
curl https://agendaflow.fpczjb.easypanel.host/api/health
# {"ok":true}

curl https://agendaflow-supabase.fpczjb.easypanel.host/auth/v1/health
# {"ok":true}  (se Kong exposto)
```

### 5.3 Rede interna (importante)

`docker-compose.yml:17` já usa `SUPABASE_INTERNAL_URL=http://agendaflow-supabase-kong:8000`. No EasyPanel, os dois serviços precisam estar **no mesmo Project** para resolver `agendaflow-supabase-kong` via DNS interno. Se criou projetos separados, use fallback público `VITE_SUPABASE_URL`.

---

## 6. Fluxo diário (VS Code → GitHub → EasyPanel)

```powershell
# 1. Desenvolver
npm run dev

# 2. Antes de commitar
npm run lint
npm run build   # verifica se VITE_ env ok

# 3. Commit & push (dispara CI + EasyPanel auto-deploy)
git add .
git commit -m "feat: nova funcionalidade"
git push origin main

# 4. Acompanhar
# GitHub Actions: https://github.com/Chapoka/agenda-flow/actions
# EasyPanel: Project → agendaflow-app → Deployments → Logs

# 5. Se mudou DB, rode bootstrap delta ou crie migration:
npx supabase migration new nome_da_migration
# edite supabase/migrations/xxx.sql e cole no SQL Editor do Studio
```

---

## 7. Troubleshooting

| Sintoma | Causa | Fix |
|---|---|---|
| Frontend `supabaseUrl is required` | Build sem Build Args | EasyPanel → App → Build Args → adicione `VITE_SUPABASE_*` e Rebuild |
| `401 Token inválido` | `JWT_SECRET` divergente entre Supabase e App | Garanta que `ANON_KEY/SERVICE_ROLE_KEY` foram gerados com mesmo `JWT_SECRET` em `.env.easypanel.ready:10-13` e que `.env.local` e EasyPanel App usam mesmos valores |
| `getUser 401` lento | Backend usando URL pública | Verifique `SUPABASE_INTERNAL_URL=http://agendaflow-supabase-kong:8000` no Env do App e que ambos estão no mesmo Project EasyPanel |
| `relation does not exist` | Bootstrap não rodado | Rode `agendaflow_bootstrap.sql` no SQL Editor |
| EasyPanel build `npm ci failed` | `package-lock.json` desatualizado | `npm install` local, commit `package-lock.json`, push |
| VS Code não formata | Extensão não instalada | `Ctrl+Shift+P` → `Extensions: Show Recommended` → Install |

Logs úteis:
```powershell
# Local
npm run build --logLevel info
docker build --build-arg VITE_SUPABASE_URL=... -t agendaflow:test . && docker run -p 3001:3001 -e PORT=3001 agendaflow:test

# EasyPanel
Project → agendaflow-app → Logs
Project → agendaflow-supabase → Logs (verifique Kong/Postgres)
```

---

## 8. Checklist final

- [x] VS Code tasks e settings ok
- [x] GitHub repo `Chapoka/agenda-flow` + secrets `VITE_*` configurados
- [ ] EasyPanel Supabase: Environment colado (`supabase/.env.easypanel.ready`) + Domain criado + Running
- [ ] Supabase SQL: `agendaflow_bootstrap.sql` rodado no SQL Editor
- [ ] EasyPanel App: GitHub conectado, Dockerfile, Build Args `VITE_*`, Env `SUPABASE_*`, Domain, Auto Deploy ON
- [ ] `git push origin main` → GitHub Actions verde → EasyPanel Deploy verde → `curl /api/health` 200

Pronto! Qualquer `git push` agora implanta automaticamente.
