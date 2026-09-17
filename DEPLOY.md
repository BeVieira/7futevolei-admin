# Deploy (Vercel + Render + Supabase)

Substitui o Railway. Front na Vercel (como já estava sendo cogitado),
backend como Web Service Docker no Render, Postgres + Storage dos
comprovantes no Supabase. Dentro do free tier dos três, sem cartão cobrado.

## Arquitetura

```
Navegador → https://<app>.vercel.app          (front estático, Vercel)
                    │
                    │ fetch cross-origin, com cookies (credentials: include)
                    ▼
            https://<backend>.onrender.com    (Express, Render)
                    │
                    ├─ Postgres     → Supabase (DATABASE_URL)
                    └─ Comprovantes → Supabase Storage (bucket público)
```

Diferente do Railway (onde front e back ficavam atrás do mesmo domínio, via
proxy interno) e diferente do que eu tinha desenhado antes pra Render+Render
(mesma ideia de proxy interno): aqui **front e back são origens diferentes
de verdade**. Isso mudou código, não só configuração — ver a seção
"O que mudou no código" mais abaixo.

---

## Passo 1 — Supabase (banco + storage)

1. [supabase.com](https://supabase.com) → **New project** (free tier, sem
   cartão). Guarde a senha do banco gerada na criação.
2. **Storage** → **New bucket** → nome `receipts` → marcar **Public
   bucket** ao criar.
3. **Project Settings → API**: copiar
   - **Project URL** → `SUPABASE_URL`
   - **secret key** (sistema novo de chaves do Supabase; era a
     `service_role` no sistema antigo) → `SUPABASE_SECRET_KEY`
4. **Project Settings → Database → Connection string**, aba **Session
   pooler** (porta `5432`, host `aws-0-<região>.pooler.supabase.com`) —
   **não** a *Transaction pooler* (porta `6543`, não suporta os prepared
   statements que `prisma migrate deploy` precisa) nem a conexão direta
   (IPv6-only no free tier; o Render só tem saída IPv4). Substituir
   `[YOUR-PASSWORD]` pela senha do passo 1. Isso vira `DATABASE_URL`.

**Sobre as outras chaves que aparecem no dashboard do Supabase:**
- `SUPABASE_PUBLISHABLE_KEY` (a que você já setou): não é usada em nada
  neste projeto — o front não fala com o Supabase diretamente, só o
  backend, e o backend usa a `secret key` (acesso total, ignora RLS) pra
  gravar comprovante em nome de qualquer aluno. Pode deixar setada, não
  atrapalha, só não faz nada.
- `SUPABASE_JWKS_URL`: **não precisa**, pode ignorar essa. Ela serve pra
  verificar localmente tokens JWT emitidos pelo *Supabase Auth* — este
  projeto não usa Supabase Auth, tem sistema de login próprio (JWT + cookie
  httpOnly, ver `apps/backend/src/lib/auth-service.ts`). Nenhum código lê
  essa variável.
- A única que falta mesmo é `SUPABASE_SECRET_KEY` (passo 1.3).

## Passo 2 — Render (backend)

1. [render.com](https://render.com) → entrar com GitHub → **New** → **Web
   Service** → escolher o repositório.
2. Preencher:
   - **Root Directory**: `apps/backend`
   - **Runtime**: **Docker** (builda o último estágio do `Dockerfile`
     existente, que é o `prod`)
   - **Instance Type**: **Free**
3. **Advanced → Health Check Path**: `/health`.
4. **Environment Variables** (ver tabela completa abaixo) — os que você já
   setou (`DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`,
   `SUPABASE_URL`, `SUPABASE_STORAGE_BUCKET`) continuam valendo, só falta:
   ```
   SUPABASE_SECRET_KEY=<passo 1.3>
   CORS_ORIGIN=<URL da Vercel, ver Passo 3 — pode voltar aqui depois>
   ```
5. **Create Web Service**. O primeiro deploy builda a imagem e sobe o
   container, que já roda `prisma migrate deploy` + seed sozinho (está no
   `Dockerfile`). Acompanhe o log até `Backend rodando em http://...`.
6. Anote a URL pública gerada, tipo `https://7futevolei-backend.onrender.com`
   — é o `VITE_API_URL` do Passo 3.

## Passo 3 — Vercel (frontend)

1. [vercel.com](https://vercel.com) → entrar com GitHub → **Add New →
   Project** → escolher o repositório.
2. Em **Root Directory**, apontar pra `apps/frontend` (a Vercel detecta
   Vite automaticamente depois disso — build command e output ficam no
   padrão).
3. **Environment Variables**:
   ```
   VITE_API_URL=https://7futevolei-backend.onrender.com/api
   ```
   Troque pela URL real do Passo 2.6. **Importante**: variáveis `VITE_*`
   são embutidas no build (não lidas em runtime) — se trocar depois, precisa
   fazer um novo deploy pra valer.
4. **Deploy**. Anote a URL final (`https://<algo>.vercel.app`, ou o domínio
   customizado se você já configurar um).
5. Volte no serviço do backend no Render → Environment → atualize
   `CORS_ORIGIN` com essa URL exata (com `https://`, sem barra no final) →
   salvar (redeploya sozinho).

---

## O que mudou no código pra isso funcionar

Front e back em domínios diferentes é "cross-origin" de verdade — sem essas
mudanças, login e as chamadas autenticadas simplesmente não funcionariam
(cookie de sessão não seria nem enviado nem aceito):

- **`apps/frontend/src/utils/http.ts`**: todas as chamadas passaram a
  mandar `credentials: "include"` — sem isso o navegador nem envia os
  cookies httpOnly de sessão numa requisição cross-site.
- **Todo `src/domain/*/api.ts`**: as URLs relativas (`/api/...`) viraram
  absolutas, montadas a partir de `VITE_API_URL` — uma URL relativa chamaria
  o próprio domínio da Vercel, que não tem `/api` nenhum.
- **`apps/backend/src/controllers/auth.controller.ts`**: os cookies de
  sessão usavam `SameSite=Lax`, que o navegador **não envia** em
  requisições cross-site feitas por `fetch`/XHR (só em navegação de
  top-level, tipo clicar num link). Em produção agora é `SameSite=None` +
  `Secure` (exige HTTPS, que o Render já dá de graça). Em dev continua
  `Lax` porque front e back seguem na mesma origem ali (proxy do Vite) e
  `None` sem HTTPS local seria descartado pelo navegador.
- **`CORS_ORIGIN`** deixou de ser opcional: sem a origem exata da Vercel
  configurada, o navegador bloqueia a resposta antes mesmo dela chegar no
  código do front.

## Variáveis de ambiente: o que migra do Railway e o que é novo

| Variável (Render, backend) | Valor | Origem |
|---|---|---|
| `DATABASE_URL` | connection string do Supabase (Passo 1.4) | **novo** — banco novo, não é o do Railway |
| `JWT_SECRET` | valor novo (`openssl rand -base64 48`) | **novo** — banco novo, sem sessão antiga pra preservar |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | copiar do Railway se quiser manter o login | **migra** (ou novo) |
| `SUPABASE_URL` | Passo 1.3 | **novo** |
| `SUPABASE_SECRET_KEY` | Passo 1.3 | **novo** |
| `SUPABASE_STORAGE_BUCKET` | `receipts` | **novo**, fixo |
| `CORS_ORIGIN` | URL da Vercel (Passo 3.4) | **novo valor** — no Railway era vazio ou outra coisa; aqui é obrigatório e é a URL da Vercel |
| `SUPABASE_PUBLISHABLE_KEY` | (o que você setou) | não usado pelo código, pode deixar ou remover |
| `SUPABASE_JWKS_URL` | — | **não precisa**, não usado pelo código |
| `PORT` | não setar | Render usa o `EXPOSE` do Dockerfile |
| `POSTGRES_USER`/`PASSWORD`/`DB` | não setar | só existiam pro Postgres local do `docker-compose` |

| Variável (Vercel, frontend) | Valor |
|---|---|
| `VITE_API_URL` | `https://<backend>.onrender.com/api` (Passo 2.6) |

---

## Passo 4 (opcional) — Migrar dados que já existem no Railway

Só necessário se o Railway hoje tem dados reais de produção (turmas,
inscrições, comprovantes) que você não quer perder. Se ainda é ambiente de
teste/pré-lançamento, pule — o seed do Passo 2 já cria o usuário admin do
zero.

1. Deixe o backend do Passo 2 no ar pelo menos uma vez — isso roda
   `prisma migrate deploy` e cria as tabelas vazias no Supabase.
2. No Railway, pegue a connection string **pública** do Postgres (aba
   *Connect* do serviço de banco — não a `*.railway.internal`).
3. Com `pg_dump`/`pg_restore` instalados localmente:
   ```bash
   pg_dump "<connection string pública do Railway>" \
     --no-owner --no-acl --data-only \
     --exclude-table=_prisma_migrations --exclude-table=User \
     -F c -f backup.dump

   pg_restore "<connection string do Supabase, Passo 1.4>" \
     --no-owner --no-acl --data-only --disable-triggers \
     backup.dump
   ```
   (`User` fica de fora porque o seed do Passo 2 já criou o admin — restaurar
   por cima daria conflito de usuário duplicado.)
4. Comprovantes (`Receipt.filePath`) que hoje apontam pra disco do Railway
   **não têm arquivo pra migrar automaticamente** — se havia comprovantes
   reais enviados, os arquivos ficaram no volume do Railway; precisa baixar
   de lá e subir manualmente pro bucket do Supabase antes de desligar o
   Railway. Me avise se for o caso, é melhor fazer isso junto.

## Rodar local com Supabase

O `.env` local do backend (`apps/backend/.env.example`) precisa de
`SUPABASE_URL`/`SUPABASE_SECRET_KEY`/`SUPABASE_STORAGE_BUCKET` — os uploads
sempre vão pro Supabase Storage, em qualquer ambiente, não existe mais disco
local. `DATABASE_URL` do `docker-compose` continua apontando pro Postgres
local (`db` no compose); só em produção (Render) é que `DATABASE_URL`
aponta pro Supabase. `VITE_API_URL` do front continua `/api` em dev (proxy
do Vite, mesma origem) — só em produção (Vercel) vira a URL absoluta do
Render.

## Limitações do free tier

- **Render free**: o serviço "dorme" depois de ~15 min sem receber
  requisição; a próxima leva uns 30–60s pra acordar. A Vercel não dorme
  (é estático), então o front carrega na hora — só a primeira chamada à API
  do dia é que demora.
- **Supabase free**: o projeto pausa depois de ~1 semana sem nenhuma
  atividade; a primeira query depois disso também demora mais.
- **Storage**: 1GB grátis no Supabase — dá pra várias centenas de
  comprovantes (até 5MB cada) antes de preocupar, sem limpeza automática.

## Depois de confirmar que está tudo funcionando

1. Testar no ar: abrir a URL da Vercel, fazer login admin, criar turma,
   inscrever, enviar comprovante e confirmar que o link abre (URL do
   Supabase).
2. Só então desligar/pausar os serviços no Railway.
