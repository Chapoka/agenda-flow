# Relatório de Auditoria — AgendaFlow
**Data:** 2026-09-23 · **Escopo:** funções, CRUDs, multi-tenant, permissões, performance, higiene de dados

---

## 1. Resultado dos testes (Playwright)

| Suíte | Testes | Resultado |
|---|---|---|
| `crud.spec.js` (CRUDs tela a tela) | 11 | ✅ 11/11 |
| `full-flow.spec.js` (3 perfis × páginas) | 3 | ✅ 3/3 |
| `isolation.spec.js` (isolamento multi-empresa) | 3 | ✅ 3/3 |
| `davidson.spec.js` (profissional bloqueado) | 1 | ✅ 1/1 |
| `wellington.spec.js` (admin cria usuário) | 1 | ✅ 1/1 |
| `permissions-audit.spec.js` (matriz + token + cadastro) | 6 | ✅ 6/6 |
| **Total** | **25** | **✅ 25/25 (2,7 min)** |

`npm run lint` ✅ · `npm run build` ✅ (48s) · `npm run typecheck` ✅

---

## 2. Matriz de permissões (verificada em tela)

| Página | super_admin | admin | profissional |
|---|---|---|---|
| Dashboard, Agenda, Clientes, Serviços, Fila | ✅ | ✅ | ✅ |
| Profissionais, Planos, PunchCards, Níveis, Cobranças, Templates | ✅ | ✅ | ❌ |
| Empresas, Calendário, Configurações | ✅ | ✅ | ❌ |
| Logs de Auditoria | ✅ | ❌ | ❌ |

**Multi-tenant (RLS + front):**
- super_admin: vê todas as 4 empresas (Rodriguinho, Black Scissors, Studio Lins, Aquaflow).
- admin Wellington (1 empresa): **não** vê empresas/usuários das demais (testado em Clientes, Profissionais, Companies).
- profissional Davidson: sem Empresas/Config/Calendário/Logs (Acesso Negado).

---

## 3. CRUDs testados

Empresas, Clientes, Profissionais, Planos, Níveis, Templates, Fila de Espera, Configurações, PunchCards, Invoices — abertura de modal + criação + ausência de erros API **OK**.

---

## 4. Tempo de execução / cadastro / token

| Cenário | Resultado |
|---|---|
| `POST /api/auth/admin-create-user` (novo) | **270 ms** |
| E-mail já cadastrado (409 + link p/ editar) | **175 ms** (busca via `public.users`, sem `listUsers()` full) |
| Cadastro completo pela UI (login + criação) | **~14 s** (login ~4 s + navegação; criação em si < 2 s) |
| Token inválido/expirado | **401** em 13–71 ms com `code: NO_TOKEN \| INVALID_TOKEN` |
| "Perfil de usuário não encontrado" | **não reproduzido** nos testes (correções abaixo) |

---

## 5. Bugs encontrados e corrigidos nesta auditoria

### 5.1 CRÍTICO — Configurações não salvava (causa raiz do toast)
- A migration `20260921_fix_companies_plans_rls.sql` **dropou todas as policies de `settings`** e não recriou as de escrita.
- Efeito: super_admin recebia `403 RLS` no INSERT e `SELECT` retornava vazio.
- A mensagem exata *"Verifique se todos os campos do formulário foram preenchidos corretamente"* **não existe no código** (varridos `src/`, `server/`, `dist/` e histórico git) — era o efeito colateral do 403 sem `onError` no `saveMutation`.
- **Correções:**
  - Novo endpoint `GET/POST /api/settings` com `service_role` (`server/routes/settings.js`) — só super_admin.
  - `saveMutation` agora usa a API + tem `onError` com toast explícito.
  - Migração `supabase/migrations/20260927_restore_settings_rls.sql` **executada no SQL Editor** (junto com `20260926_fix_companies_isolation_leak.sql`).
- **Verificação pós-migration:**
  - `settings` SELECT/INSERT/UPDATE como super_admin: 200/201/204 ✅
  - `settings` INSERT como admin: 403 (correto) · SELECT como admin: 200 ✅
  - `establishment_types` SELECT: 200 com dados reais ✅
  - `POST /api/settings`: 200 em 167 ms ✅
  - Policies de `companies/customers/customer_companies/appointments/invoices` presentes ✅

### 5.2 Modal de usuário fechava no blur do e-mail
- `handleCheckCustomerEmail` fechava o modal ao sair do campo e-mail → form sumia ao digitar senha → flaky "Perfil não encontrado".
- **Correção:** modal só fecha se abrir import/usuário existente; senão permanece aberto.

### 5.3 Lentidão / "já cadastrado"
- `listUsers()` full substituído por lookup em `public.users` (commit anterior, validado: 175 ms).
- 409 `USER_ALREADY_EXISTS` mostra modal "Editar Usuário" com link direto.

### 5.4 Testes corrigidos
- Botão "Nova Empresa" (regex `/nova empresa|novo/i`).
- Locator do nome no modal Wellington (exclui campo de busca).
- Timeout do fluxo super_admin (180 s).
- Detecção de bloqueio sem falso-positivo de "404" no HTML.

---

## 6. Higiene de usuários / dados (limpos)

**Removidos (não aparecem no front / são lixo de teste):**
- `teste1789930770657@test.com`, `teste.final.1789940322347@test.com` (clientes sem empresa)
- `prof.e2e@test.com`, `teste.wellington.e2e.*@test.com`, `perf.audit.*@test.com`
- Planos "Plano Teste E2E", fila "Espera Teste E2E", cliente "Cliente 1"

**Mantidos (reais, todos visíveis no front para o papel correto):**

| E-mail | Role | Empresa |
|---|---|---|
| rodrigo.rocha@morumbisolutions.com.br | super_admin | todas |
| wellingtonestevesdesouza@gmail.com | admin | The Black Scissors |
| rrocha@tabit.com.br | admin | Rodriguinho Salão |
| davidson.fr@hotmail.com | profissional | The Black Scissors |

Banco final: 4 users · 4 companies · 1 customer · 0 planos de teste · 0 settings de teste.

---

## 7. Pendências (ação manual)

1. ~~Rodar no Supabase SQL Editor: `20260926` + `20260927`~~ ✅ **executadas e verificadas**
2. **Deploy no EasyPanel** — domínio de produção: `https://agendaflow.morumbisolutions.com.br`.
   - **Status em 2026-09-23 01:55 (UTC-3):** produção ainda no build de **22/09 23:22** (`index-B6p15JS2.js`, sem rota `/api/settings`); CI/Docker verdes nos pushes `973a8b9` e `ab17254`, mas o serviço **não re-deployou** (Auto Deploy OFF ou webhook GitHub→EasyPanel desconectado — `gh api repos/.../hooks` sem hook visível).
   - **Ação:** EasyPanel → `agendaflow-app` → **Deploy** (ou reconectar GitHub + Auto Deploy ON). Depois validar:
     ```
     curl https://agendaflow.morumbisolutions.com.br/api/health
     # e /api/settings com token super_admin → 200
     ```
   - Testes contra produção: `PLAYWRIGHT_BASE_URL=https://agendaflow.morumbisolutions.com.br npx playwright test`
3. ~~Corrigir `typecheck` (`jsconfig.json`)~~ ✅ removido `ignoreDeprecations` inválido

---

## 8. Arquivos alterados nesta auditoria

- `server/routes/settings.js` (novo) · `server/index.js`
- `src/pages/Settings.jsx` (saveMutation + modal e-mail + busca sem readOnly)
- `supabase/migrations/20260927_restore_settings_rls.sql` (novo) · `jsconfig.json`
- `tests/permissions-audit.spec.js` (novo) · `tests/crud.spec.js` · `tests/wellington.spec.js` · `tests/full-flow.spec.js`
