# Deploy (Vercel + Render + Supabase)

Substitui o Railway. Front na Vercel (como já estava sendo cogitado),
backend como Web Service Docker no Render, Postgres + Storage dos
comprovantes no Supabase. Dentro do free tier dos três, sem cartão cobrado.

## Arquitetura

```
Navegador → https://<app>.vercel.app          (front estático, Vercel)
                    │
                    │ fetch /api/* (mesma origem, com cookies)
                    ▼
            rewrite do vercel.json (proxy no edge da Vercel)
                    │
                    ▼
            https://<backend>.onrender.com    (Express, Render)
                    │
                    ├─ Postgres     → Supabase (DATABASE_URL)
                    └─ Comprovantes → Supabase Storage (bucket público)
```

Igual ao Railway (onde front e back ficavam atrás do mesmo domínio via proxy
interno): o `vercel.json` tem um rewrite de `/api/*` pro backend no Render,
então do ponto de vista do navegador a API é **mesma origem** — só o proxy
da Vercel fala com o Render por fora. Chegamos a tirar esse rewrite achando
que domínios diferentes (Vercel/Render) obrigavam cross-origin de verdade,
mas não é o caso: qualquer destino externo funciona num rewrite, igual
funcionava com o Railway. Sem o proxy, o cookie de sessão precisa de
`SameSite=None`, que o Safari/iOS trata como rastreamento entre sites e
descarta — login parecia funcionar e a sessão caía na hora seguinte,
especificamente no Safari mobile. Ver "O que mudou no código" mais abaixo.

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
   setou (`DATABASE_URL`, `JWT_SECRET`, `SUPABASE_URL`,
   `SUPABASE_STORAGE_BUCKET`) continuam valendo, só falta:
   ```
   SUPABASE_SECRET_KEY=<passo 1.3>
   CORS_ORIGIN=<URL da Vercel, ver Passo 3 — pode voltar aqui depois>
   GOOGLE_CLIENT_ID=<Client ID do OAuth do Google>
   ADMIN_EMAILS=<e-mails Google dos admins, separados por vírgula>
   ```
5. **Create Web Service**. O primeiro deploy builda a imagem e sobe o
   container, que já roda `prisma migrate deploy` sozinho (está no
   `Dockerfile`). Não há seed: o admin entra com Google, com o e-mail em
   `ADMIN_EMAILS`. Acompanhe o log até `Backend rodando em http://...`.
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
   VITE_API_URL=/api
   ```
   Igual ao dev: o front chama `/api` relativo, e o rewrite do
   `apps/frontend/vercel.json` (`/api/:path*` → URL do Render) é quem manda
   pro backend de verdade — mesma origem do ponto de vista do navegador.
   Se o rewrite ainda aponta pra outra URL do Render, atualize
   `apps/frontend/vercel.json` com a URL real do Passo 2.6 antes do deploy.
4. **Deploy**. Anote a URL final (`https://<algo>.vercel.app`, ou o domínio
   customizado se você já configurar um).
5. (Opcional) Volte no serviço do backend no Render → Environment → setar
   `CORS_ORIGIN` com essa URL. Como o navegador só fala com a Vercel (o
   proxy do rewrite é quem chama o Render, servidor pra servidor), CORS não
   entra mais em jogo pro app em si — só vale a pena setar se for chamar o
   Render diretamente por fora do front (ex: Swagger UI em `/docs`).

---

## O que mudou no código pra isso funcionar

- **`apps/frontend/vercel.json`**: rewrite de `/api/:path*` pro Render,
  igual ao que existia pro Railway — é o que mantém a API "mesma origem" do
  ponto de vista do navegador.
- **`apps/frontend/src/utils/http.ts`** e todo `src/domain/*/api.ts`:
  `credentials: "include"` nas chamadas e `VITE_API_URL` (que em produção
  também é `/api`, igual ao dev) — mantidos porque não atrapalham e deixam
  a base de URL centralizada num lugar só.
- **`apps/backend/src/controllers/auth.controller.ts`**: os cookies de
  sessão usam `SameSite=Lax` (não `None`) — como o navegador só fala com a
  Vercel, o cookie que ele recebe é first-party de verdade, `Lax` de
  verdade funciona, e evita o descarte do cookie que o Safari/iOS faz com
  `SameSite=None` em requisição cross-site.
- **`CORS_ORIGIN`** continua existindo no backend mas é opcional agora — só
  importa pra quem chamar o Render direto (fora do proxy da Vercel).

## Variáveis de ambiente: o que migra do Railway e o que é novo

| Variável (Render, backend) | Valor | Origem |
|---|---|---|
| `DATABASE_URL` | connection string do Supabase (Passo 1.4) | **novo** — banco novo, não é o do Railway |
| `JWT_SECRET` | valor novo (`openssl rand -base64 48`) | **novo** — banco novo, sem sessão antiga pra preservar |
| `GOOGLE_CLIENT_ID` | Client ID do OAuth do Google (tipo "Aplicativo da Web") | **novo** — login só com Google |
| `ADMIN_EMAILS` | e-mails Google dos admins, separados por vírgula | **novo** — substitui `ADMIN_USERNAME`/`ADMIN_PASSWORD` |
| `SUPABASE_URL` | Passo 1.3 | **novo** |
| `SUPABASE_SECRET_KEY` | Passo 1.3 | **novo** |
| `SUPABASE_STORAGE_BUCKET` | `receipts` | **novo**, fixo |
| `CORS_ORIGIN` | URL da Vercel (Passo 3.4), opcional | **novo valor**, mas não obrigatório — o front chama via proxy da Vercel, não direto |
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
teste/pré-lançamento, pule — o admin entra com Google no primeiro acesso,
sem precisar de dado nenhum.

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
   (`User` fica de fora porque o admin antigo era de usuário/senha, que não
   existe mais — as contas nascem no primeiro login com Google.)
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
aponta pro Supabase. `VITE_API_URL` do front é `/api` tanto em dev (proxy
do Vite) quanto em produção (rewrite do `vercel.json`) — em ambos os casos
é mesma origem do ponto de vista do navegador.

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
