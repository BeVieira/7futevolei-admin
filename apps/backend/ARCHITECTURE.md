# Arquitetura do backend

Express + TypeScript + Prisma. Este documento cobre **como o código é
estruturado e por quê** — as regras de negócio em si (como funciona o
rebalanceamento de vagas, a trava de lista, etc.) estão em
`../../DOMAIN_RULES.md`, na raiz do monorepo, porque são conhecimento sobre
o produto, não sobre a organização do código.

## Camadas

```
src/
  routes/          # Express Router + doc OpenAPI, um arquivo por recurso
    class-session.routes.ts
    user.routes.ts            # busca de usuários (admin) e edição do próprio perfil
    job.routes.ts             # jobs chamados pelo cron externo (lembrete de comprovante)
  controllers/     # um handler por endpoint: valida, chama lib/, serializa a resposta
    class-session.controller.ts
  schemas/         # validação de payload com Zod
    class-session.schema.ts
  lib/             # regra de negócio + utilitários compartilhados
    enrollment-service.ts     # inscrever/cancelar/remover/rebalancear
    class-session-lock.ts     # cálculo de trava de lista
    class-levels.ts           # enum de nível de aula + ordenação
    prisma.ts                 # instância única do PrismaClient
    asyncHandler.ts           # adapta handler async pro Express
    swagger.ts                # schemas OpenAPI compartilhados
    push-service.ts           # inscrições e envio de Web Push (VAPID)
    enrollment-notifications.ts # textos + disparo best-effort dos avisos de inscrição
    class-opening-notifications.ts # aviso "turmas abertas" (botão do admin, broadcast + registro anti-spam)
    google-auth.ts            # valida o ID token do Google (login)
    login-nonce.ts            # tentativas de login do fluxo de redirect (nonce)
    auth-service.ts           # upsert do User, emissão/renovação/revogação da sessão
    requireAuth.ts            # middlewares requireAuth / requireAdmin
    requireCronSecret.ts      # middleware das rotas de job (Bearer CRON_SECRET)
    receipt-reminders.ts      # job de lembrete de comprovante (rota + intervalo local)
  types/
    express.d.ts   # tipa res.locals.user (preenchido pelos middlewares de auth)
  index.ts         # monta o Express app, CORS, /health, /docs, error handler
```

Fluxo de uma requisição:

```
routes (Express) → controller (valida com schema, chama lib) → lib (Prisma) → Postgres
```

Ao adicionar um recurso novo, replique o padrão: schema Zod → controller com
as funções do CRUD → arquivo de rotas (com comentários `@openapi`) → monte o
router em `src/index.ts`. Schemas OpenAPI reutilizáveis (`ClassSession`,
`Enrollment`, ...) ficam centralizados em `lib/swagger.ts`, não duplicados
em cada rota.

## `asyncHandler`: por que todo handler passa por ele

Handlers de rota são `async`. Sem tratamento, uma `Promise` rejeitada dentro
de um handler do Express **não** cai automaticamente no middleware de erro
— ela vira uma unhandled rejection silenciosa. `asyncHandler` resolve isso
de um jeito só, no ponto de registro da rota:

```ts
export function asyncHandler(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}
```

Todo `classSessionRouter.get/post/patch/delete` embrulha o controller com
`asyncHandler(...)` — nunca registre um handler async sem ele.

## Ordem das rotas: estáticas antes de `:id`

`GET /dates` precisa estar registrada **antes** de `GET /:id`. Rotas
Express são tentadas na ordem de registro, e `:id` casa com qualquer
segmento — incluindo o literal `"dates"`. Se a ordem fosse invertida,
`GET /api/class-sessions/dates` cairia no handler de `getClassSessionById`
em vez de `listClassDatesByMonth`. Essa regra vale para qualquer rota
estática nova que comece com o mesmo prefixo de uma rota `:param`.

## Autenticação: `requireAuth`/`requireAdmin` por rota, não por router inteiro

Três peças, cada uma num arquivo de `lib/`:

- **`google-auth.ts`** — integração externa: `verifyGoogleCredential`
  valida o ID token do Google Identity Services (`google-auth-library`,
  `aud` = `GOOGLE_CLIENT_ID`, só e-mail verificado) e devolve o
  `GoogleProfile` mais o `nonce` do token. Sem `GOOGLE_CLIENT_ID` lança
  `GoogleLoginNotConfiguredError` (o callback redireciona com
  `?erro=configuracao` — ver "Funcionalidade que depende de variável de
  ambiente", abaixo).
- **`auth-service.ts`** — regra da sessão: `upsertUserFromGoogle` (upsert
  por `googleId`, não sobrescreve `name`, papel recalculado por
  `ADMIN_EMAILS` e mudança de papel no log), `issueSession`,
  `refreshSession`, `invalidateSession`, `isSessionActive` e
  `toUserProfile` (o shape `{ id, name, email, photoUrl, role }` que
  `/auth/refresh`, `/auth/me` e `PATCH /users/me`
  devolvem). Detalhes da sessão em "Sessão: uma linha de `Session` por
  aparelho", abaixo.
- **`requireAuth.ts`** — os dois middlewares Express. Ambos leem o cookie
  `access_token`, verificam assinatura e conferem `isSessionActive` (o
  `jti` do token ainda é o vigente no banco), respondendo `401` se
  ausente/inválido/revogado:
  - `requireAuth` — qualquer usuário logado (aluno ou admin);
  - `requireAdmin` — idem, mais `role === "ADMIN"`, senão `403`.

  Os dois seguem com `res.locals.user = { id, role }` (`SessionUser`,
  tipado em `src/types/express.d.ts`). O controller lê a identidade **só**
  dali — nunca de um id ou nome vindo do payload:

  ```ts
  await cancelEnrollment(id, res.locals.user.id);
  ```

`POST /api/auth/refresh` (controller `refresh`, sem middleware — é o
próprio refresh token, cookie `refresh_token` com path restrito a
`/api/auth`, que autentica essa rota) usa `refreshSession` pra validar o
refresh token e emitir um par novo, invalidando o par anterior — é assim
que o front renova a sessão sem pedir login de novo quando o access token
de 5min expira.

### Sessão: uma linha de `Session` por aparelho

Cada login cria um registro em `Session` (`id` = `sid` no token,
`accessJti`, `refreshJti`, `previousRefreshJti`, `lastUsedAt`,
`expiresAt`); o JWT leva `{ sub: userId, role, jti, sid, type }`,
assinado e verificado com `HS256` fixo. Multi-sessão: logar no celular não
derruba o computador.

- **`isSessionActive`** busca a sessão pela PK (`sid`) e confere que o
  `jti` do access token é o `accessJti` gravado — é o que torna o JWT
  revogável antes de expirar. Os middlewares continuam devolvendo só
  `res.locals.user = { id, role }`.
- **`refreshSession`** é um compare-and-swap: `updateMany({ where: { id,
  refreshJti: <apresentado> } })` só rotaciona se o refresh ainda for o
  vigente. O refresh da rotação anterior (`previousRefreshJti`) ainda é
  aceito por 10s (`REFRESH_REUSE_GRACE_MS`) e recebe o par vigente
  **reassinado** (mesmos `jti`, sem rotacionar de novo) — cobre duas abas
  renovando juntas e o PWA do iOS que perdeu a resposta da renovação ao ir
  pro segundo plano. Qualquer outro refresh não vigente (o anterior fora
  da janela, ou um mais velho) é tratado como **reuso de token** e apaga a
  sessão inteira — `InvalidSessionError` (401 + limpa os cookies). O **papel é recalculado** de `ADMIN_EMAILS` a cada renovação
  (e gravado no `User` se mudou), nunca copiado do token antigo.
- **Validade do refresh por papel** (`REFRESH_TTL_MS_BY_ROLE`): aluno 90
  dias, admin 30. O cookie acompanha (`SessionTokens.refreshMaxAgeMs`).
- **`invalidateSession`** (logout) apaga só a sessão do token apresentado.
  `issueSession` aproveita o login pra apagar as sessões vencidas
  (`expiresAt`) daquele usuário.
- O `jti` fica puro no banco, sem hash: sozinho ele não vira token — falta
  a assinatura com `JWT_SECRET`, que não está no banco.

### Login com Google: fluxo de redirect com nonce

Só existe uma porta de login: o **fluxo de redirect** do Google Identity
Services (motivo em `apps/frontend/ARCHITECTURE.md`). Não há rota que
aceite um ID token em JSON — ela aceitaria token sem nonce (um token
capturado poderia ser reapresentado). Duas rotas, com a regra em
`lib/login-nonce.ts`:

1. `POST /google/nonce` — cria uma tentativa (`LoginNonce`, 10 min): um
   **segredo** aleatório vai **só** pro cookie `login_nonce` (httpOnly,
   `SameSite=None; Secure`, path `/api/auth/google`); o JSON devolve só o
   **nonce** (SHA-256 do segredo), que o front passa pro Google e o Google
   embute no ID token. O segredo nunca fica acessível ao JavaScript.
2. `POST /google/callback` — o `login_uri`. Recebe um **formulário**
   (`express.urlencoded` só nessa rota), valida o ID token e exige que o
   `nonce` dele seja o hash do segredo do cookie **deste** navegador e uma
   tentativa pendente; consome a tentativa (uso único, `deleteMany`
   condicionado), abre a sessão e responde 303 pra `/login?status=ok`. Sem
   o cookie (outro navegador, cookie recusado, tentativa vencida ou já
   usada): nenhuma sessão, 303 pra `/login?erro=tentativa-expirada`.

Por que o cookie é `SameSite=None`: o POST do Google pro callback é uma
navegação cross-site, e um cookie `Lax` não vai nela (a exceção "Lax+POST"
de 2 minutos é só do Chrome e só pra cookie sem `SameSite` declarado). Por
isso também o double-submit `g_csrf_token` do próprio Google não é usado.
Consequência: o Safari não grava cookie `Secure` em `http://localhost`,
então nele o login só funciona por HTTPS (túnel) — Chrome e Firefox aceitam
`Secure` em localhost.

O que isso impede: um site (ou link) que leve a vítima a logar e faça o
navegador dela postar um ID token pro nosso callback não abre sessão em
lugar nenhum além do navegador da própria vítima, e só se ela mesma pediu
aquela tentativa; o ID token de outra conta postado no navegador da vítima
(login forjado) não bate com o cookie dela.

Os erros do callback viram códigos em `/login?erro=<código>` via
`toLoginErrorCode`: `InvalidGoogleCredentialError` → `credencial`,
`InvalidLoginNonceError` → `tentativa-expirada`,
`GoogleLoginNotConfiguredError` → `configuracao`, `P2002` de e-mail já
usado por outra conta Google → `email-em-uso`.

### `trust proxy` e rate limit

Os rate limits (login, push) contam por `req.ip`. Atrás de proxy, o Express
só lê o IP real do `X-Forwarded-For` se souber quantos saltos confiar:
`TRUST_PROXY_HOPS` (env, padrão 0) vira `app.set("trust proxy", N)` em
`src/index.ts`. Valor errado pra menos = todo mundo com o IP do proxy
(limite global); pra mais = cliente forja o IP no header. Como conferir em
produção está no `DEPLOY.md`.

### Busca de usuários: SQL cru com escape de LIKE

`GET /api/users` usa `$queryRaw` com `ILIKE ... ESCAPE '!'` e escapa `%`,
`_` e `!` do termo antes (`escapeLikePattern`), em vez do `contains` do
Prisma — assim o que o admin digita é buscado literalmente sem depender de
como o Prisma trata curingas no termo.

### Visão pública × visão do admin no detalhe da turma

`GET /api/class-sessions/:id` é público e devolve só nome e lado de cada
inscrição. O admin usa `GET /api/class-sessions/:id/admin`
(`requireAdmin`), que acrescenta `userId` (null = convidado) e o
comprovante. Foi uma rota própria, e não a rota pública lendo a sessão de
forma opcional, porque o cookie do access token expira junto com o token
(5 min): depois disso o navegador simplesmente não manda cookie nenhum, a
leitura opcional enxergaria um anônimo e devolveria a visão pública **sem
erro** — e o front só renova a sessão quando recebe 401. Com
`requireAdmin`, a falta de cookie vira 401, o front renova e repete.

Rotas públicas, de aluno e de admin convivem no **mesmo** `Router`
(`classSessionRouter`), então o middleware entra como argumento extra
**por rota**, não como `router.use(...)` no arquivo inteiro — mesmo
padrão já usado por `uploadReceiptFile`. Quando os dois aparecem juntos,
o de auth vem primeiro (não faz sentido receber o arquivo de quem nem
está logado):

```ts
classSessionRouter.delete(
  "/:id",
  requireAdmin,
  asyncHandler(deleteClassSession),
);

classSessionRouter.post(
  "/:id/enrollments/:enrollmentId/receipt",
  requireAuth,
  uploadReceiptFile,
  asyncHandler(submitReceipt),
);
```

`userRouter` (`/api/users`) segue o mesmo padrão: `GET /` (busca por nome
ou e-mail, até 20, pra o admin escolher quem inscrever) com
`requireAdmin`, `PATCH /me` (o próprio usuário troca o nome exibido) com
`requireAuth`.

Os middlewares são `async` (conferem `isSessionActive` no banco), mas
tratam os próprios erros com `try/catch` internamente — por isso não
precisam de `asyncHandler` como os demais handlers assíncronos, que deixam
o `catch(next)` do `asyncHandler` reportar o erro. Ao proteger uma rota
nova: adicione `requireAuth` ou `requireAdmin` nesse mesmo lugar (antes
do `asyncHandler(handler)`) e marque `security: [{ cookieAuth: [] }]` + a
resposta `401` (e `403`, se for `requireAdmin`) no bloco `@openapi`
correspondente.

## Erros: uma classe por regra, um `instanceof` por controller

Regra de negócio que pode falhar de um jeito específico vira uma classe de
erro exportada de `lib/`, não uma string solta:

```ts
// lib/enrollment-service.ts
export class EnrollmentNotFoundError extends Error { ... }
export class ClassSessionLockedError extends Error { ... }
```

O controller decide o HTTP status certo checando o tipo, nunca a mensagem:

```ts
} catch (error) {
  if (error instanceof EnrollmentNotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }
  if (error instanceof ClassSessionLockedError) {
    res.status(409).json({ error: error.message });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    res.status(404).json({ error: "Class session not found" });
    return;
  }
  throw error; // deixa o error handler global (src/index.ts) responder 500
}
```

Ao adicionar uma regra nova que deve rejeitar com um status específico:
crie a classe de erro perto de onde a regra é decidida (`lib/`), lance-a
ali, e adicione **um** bloco `instanceof` no controller que chama essa
função — nunca decida o status dentro do `lib/` (que não conhece HTTP).

## Transações: `Serializable` + retry, não "confiar que não vai colidir"

`enrollment-service.ts` só mexe em `Enrollment`/`ClassSession` dentro de
`prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })`.
Motivo: duas pessoas podem se inscrever no mesmo instante na última vaga de
um lado da quadra — sem isolamento serializável, ambas leriam "ainda tem
vaga" antes de qualquer uma commitar, e as duas seriam confirmadas,
estourando a capacidade.

`Serializable` no Postgres detecta esse conflito e aborta uma das duas
transações com o erro `P2034`. `withSerializableRetry` reexecuta
automaticamente (até `MAX_SERIALIZATION_RETRIES`, hoje 3) só esse tipo de
erro — qualquer outro erro (validação, não encontrado, trava de lista)
propaga na hora, sem retry:

```ts
async function withSerializableRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const isSerializationFailure =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!isSerializationFailure || attempt >= MAX_SERIALIZATION_RETRIES) throw error;
    }
  }
}
```

Toda função de `enrollment-service.ts` que muda estado (`enrollStudent`,
`cancelEnrollment`, `removeEnrollmentById`, `updateClassSessionWithRebalance`,
`deleteClassSessionAndNotify`) segue esse mesmo formato:
`withSerializableRetry(() => prisma.$transaction(async (tx) => { ... }, { isolationLevel: Serializable }))`.
Uma função nova que lê-then-escreve com uma invariante a proteger (capacidade,
unicidade, etc.) deve seguir o mesmo padrão, não um `prisma.enrollment.create`
solto fora de transação.

O retry não cobre violação de índice único (`P2002`): duas inscrições do
mesmo usuário na mesma turma ao mesmo tempo (clique duplo, duas abas)
passam as duas pela checagem de "já inscrito" e a segunda bate no
`@@unique([classSessionId, userId])`. `enrollStudent` traduz esse `P2002`
pro mesmo `AlreadyEnrolledError` (409) da checagem explícita, em vez de
deixar virar 500.

## Notificação: depois do commit, fora do retry, sem `await`

Promoção da lista de espera, rebaixamento pra espera (redução de
capacidade), remoção pelo admin e exclusão de turma avisam
o aluno por push (`lib/enrollment-notifications.ts`). O aviso **nunca**
sai de dentro do `prisma.$transaction`:

- dentro da transação ela ainda pode abortar (ou ser reexecutada pelo
  `withSerializableRetry`) — avisaria alguém de uma promoção que não
  aconteceu, ou duas vezes;
- push é rede externa lenta, e segurar uma transação `Serializable` aberta
  esperando o serviço de push aumenta a chance de conflito (`P2034`).

Por isso a transação só **devolve quem foi afetado** (`promoted` — pares
`{ enrollmentId, userId }`, `demoted` no reencaixe de capacidade,
a inscrição removida, os `userId` da turma excluída — lidos antes do
`delete`) e a função exportada dispara o aviso depois que o
`withSerializableRetry` retorna:

```ts
const { classSession, counters, promoted } =
  await withSerializableRetry(() => prisma.$transaction(async tx => { ... }));

void notifyWaitlistPromotion(classSession, promoted);
return counters;
```

As funções `notifyX` são best-effort: nunca rejeitam (erro vira log, push
não configurado é ignorado) e o chamador não espera por elas (`void`) — a
resposta HTTP da inscrição não fica presa ao serviço de push nem falha por
causa dele. Só `userId` entra (convidado não tem aparelho), e aula que já
terminou não gera aviso. Um caminho novo que mude status de inscrição
(promoção, remoção) deve seguir esse mesmo formato.

## Prisma: schema → migração → client

1. Edite `prisma/schema.prisma`.
2. Rode a migração **dentro do container** do backend — `DATABASE_URL` usa
   o hostname `db`, que só resolve na rede do Docker Compose, não no host:
   ```bash
   docker compose exec backend pnpm prisma:migrate
   ```
3. Isso já regenera o Prisma Client dentro do container. Se for só recarregar
   os types no editor do host (sem gerar migração), rode
   `pnpm prisma:generate` localmente.
4. Reinicie o container (`docker compose restart backend`) se o `tsx watch`
   não pegar o client novo sozinho.

## Documentação OpenAPI

Cada rota tem um bloco `/** @openapi ... */` acima do registro
(`classSessionRouter.get(...)`), no formato JSDoc-OpenAPI processado por
`swagger-jsdoc` (configurado em `lib/swagger.ts`, que também centraliza os
`components.schemas` reaproveitados entre rotas — `ClassSession`,
`Enrollment`, `BulkCreateInput`, etc.). Doc disponível em `/docs` (Swagger
UI) com o servidor rodando. Toda rota nova precisa do bloco correspondente
— é a única documentação de contrato de API que existe no projeto.

## Funcionalidade que depende de variável de ambiente: 503, não crash

Push (`lib/push-service.ts`) precisa das chaves `VAPID_*`. Sem elas o
servidor **sobe normalmente** e só as rotas que dependem disso respondem
`503` (via `PushNotConfiguredError`, tratado no controller como as outras
classes de erro). O login com Google (`lib/google-auth.ts`) segue o mesmo
padrão com `GOOGLE_CLIENT_ID` (`GoogleLoginNotConfiguredError` — como o
callback responde com redirect, ali o erro vira `?erro=configuracao` em
vez de 503). Assim um ambiente sem a configuração — um dev novo, um
preview — não quebra o resto da API. Siga o mesmo padrão para qualquer
integração externa opcional: checa a configuração uma vez no carregamento
do módulo, lança um erro próprio na hora do uso.

As rotas de job (`/api/jobs/*`, ver abaixo) seguem a mesma ideia com
`CRON_SECRET`: sem ele respondem `503` em vez de ficarem abertas.

`sendPushNotification(payload, where, options)` é o ponto único de envio:
recebe um filtro do Prisma para escolher os aparelhos (um aluno:
`{ userId }`), opções de entrega (`TTL`, `urgency`, `topic`) e já apaga as
inscrições que o serviço de push responde como expiradas (404/410). Os
avisos de inscrição usam `topic` = `enrollment-<id>` (o serviço de push
substitui uma mensagem pendente da mesma inscrição pela mais nova), TTL até
o fim da aula e `urgency: "high"`; o lembrete de comprovante, TTL de 24h.

O aviso de turmas abertas (`POST /api/class-sessions/opening-notification`,
admin) é o único envio pra **todos** os aparelhos (`where` vazio) e o único
com `await` no request — é uma ação explícita do admin, que espera ver
quantos aparelhos receberam. Cada disparo grava um
`ClassOpeningNotification`; sem `force: true`, a rota responde `409` (com
`lastSentToday`) se já existe registro desde a meia-noite de Brasília. O
front consulta `GET` da mesma rota pra abrir a confirmação antes, e o 409
só cobre dois admins disparando ao mesmo tempo (sem lock: no pior caso,
dois avisos saem juntos).

Duas proteções na inscrição do aparelho (`POST /push/subscribe`):

- **Allowlist de endpoint (anti-SSRF):** o servidor faz POST no
  `endpoint` a cada envio, então `subscribeSchema` só aceita `https:` (sem
  porta) nos hosts dos serviços de push dos navegadores (FCM, Apple,
  Mozilla, WNS). Um host novo de navegador entra nessa lista.
- **Sem sequestro de aparelho:** `saveSubscription` só reatribui um
  endpoint já gravado a outro usuário se `p256dh`/`auth` baterem — `auth`
  é um segredo que só o navegador inscrito tem. Chaves diferentes no mesmo
  endpoint → `PushSubscriptionConflictError` (409), sem mexer no registro;
  o front então desfaz a inscrição local e cria uma nova.

## Jobs: rota idempotente chamada de fora, não agendador interno

Tarefa periódica (hoje só o lembrete de comprovante) é uma **rota** —
`POST /api/jobs/receipt-reminders` — chamada por um cron externo
(cron-job.org em produção), não um `setInterval`/`node-cron` no processo.
O backend pode dormir/reiniciar/ter várias instâncias e o horário do
disparo fica configurado num lugar visível, fora do código.

- **Autenticação por segredo, não por sessão:** `requireCronSecret`
  compara `Authorization: Bearer <token>` com `CRON_SECRET` em tempo
  constante (`timingSafeEqual` sobre o SHA-256 dos dois, que iguala o
  tamanho). Sem `CRON_SECRET` → `503`; segredo errado → `401`.
- **Idempotente por marcação no banco:** cada inscrição lembrada recebe
  `receiptReminderSentAt`. O job "reserva" a inscrição com um
  `updateMany` condicionado a `receiptReminderSentAt: null` **antes** de
  enviar o push e só envia se `count === 1` — duas execuções sobrepostas
  (cron atrasado + intervalo local, retry do cron) nunca avisam o mesmo
  aluno duas vezes. Rodar a rota de novo é sempre seguro. Se o envio
  falhar por erro transitório sem alcançar nenhum aparelho (serviço de
  push fora, erro de rede), a marcação é desfeita pra próxima execução
  tentar de novo; aparelho expirado (404/410) ou nenhum aparelho não
  desfaz.
- **Janela limitada:** só entram aulas que terminaram nas últimas 24h
  (`REMINDER_WINDOW_HOURS`), pra uma primeira execução (ou o job voltando
  depois de dias desligado) não cobrar aulas antigas.
- **Fuso:** o fim da aula é `computeClassSessionEnd` (`date` meia-noite
  UTC + `endTime` em Brasília, ver `class-session-lock.ts`) — nunca
  comparar `endTime` com a hora UTC do servidor.
- **Intervalo local opcional:** `startReceiptReminderInterval` (chamado no
  `app.listen`) roda a **mesma** função da rota a cada
  `RECEIPT_REMINDER_INTERVAL_MS`, só se a variável estiver definida — pra
  testar em dev sem cron externo.

Um job novo (ex: lembrete de trava de lista) segue o mesmo formato: função
em `lib/` com marcação idempotente própria, rota em `job.routes.ts` atrás de
`requireCronSecret`, e um novo horário no cron externo.
