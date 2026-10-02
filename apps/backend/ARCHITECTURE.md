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
    google-auth.ts            # valida o ID token do Google (login)
    auth-service.ts           # upsert do User, emissão/renovação/revogação da sessão
    requireAuth.ts            # middlewares requireAuth / requireAdmin
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
  `aud` = `GOOGLE_CLIENT_ID`, só e-mail verificado) e devolve um
  `GoogleProfile`. Sem `GOOGLE_CLIENT_ID` lança
  `GoogleLoginNotConfiguredError` (503 — ver "Funcionalidade que depende
  de variável de ambiente", abaixo).
- **`auth-service.ts`** — regra da sessão: `upsertUserFromGoogle` (upsert
  por `googleId`, não sobrescreve `name`, papel recalculado por
  `ADMIN_EMAILS` e mudança de papel no log), `issueSession`,
  `refreshSession`, `invalidateSession`, `isSessionActive` e
  `toUserProfile` (o shape `{ id, name, email, photoUrl, role }` que
  `/auth/google`, `/auth/refresh`, `/auth/me` e `PATCH /users/me`
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
  pro segundo plano. Fora disso, `InvalidSessionError` (401 + limpa os
  cookies). O **papel é recalculado** de `ADMIN_EMAILS` a cada renovação
  (e gravado no `User` se mudou), nunca copiado do token antigo.
- **Validade do refresh por papel** (`REFRESH_TTL_MS_BY_ROLE`): aluno 90
  dias, admin 30. O cookie acompanha (`SessionTokens.refreshMaxAgeMs`).
- **`invalidateSession`** (logout) apaga só a sessão do token apresentado.
  `issueSession` aproveita o login pra apagar as sessões vencidas
  (`expiresAt`) daquele usuário.
- O `jti` fica puro no banco, sem hash: sozinho ele não vira token — falta
  a assinatura com `JWT_SECRET`, que não está no banco.

### Login com Google: JSON e callback de redirect

Duas portas pro mesmo `startSessionFromGoogle` (`auth.controller.ts`):

- `POST /api/auth/google` — JSON `{ credential }`, responde JSON. Fica pra
  quem obtiver o ID token por conta própria (ex: Swagger, popup).
- `POST /api/auth/google/callback` — o `login_uri` do fluxo de redirect
  do Google Identity Services, que é o que o front usa (motivo em
  `apps/frontend/ARCHITECTURE.md`). Recebe um **formulário**
  (`express.urlencoded` só nessa rota), exige o double-submit
  `g_csrf_token` (cookie == campo do corpo) e responde sempre com **303**
  pra `/login?status=ok` ou `/login?erro=<código>` — caminho relativo, pra
  o navegador resolver na origem do front (em produção a requisição chega
  pelo rewrite da Vercel).

Os erros de login (`InvalidGoogleCredentialError` → 401,
`GoogleLoginNotConfiguredError` → 503, `P2002` de e-mail já usado por
outra conta Google → 409) passam por `toLoginFailure`, que devolve status
**e** código, pra cada porta responder do seu jeito.

### `trust proxy` e rate limit

Os rate limits (login, push) contam por `req.ip`. Atrás de proxy, o Express
só lê o IP real do `X-Forwarded-For` se souber quantos saltos confiar:
`TRUST_PROXY_HOPS` (env, padrão 0) vira `app.set("trust proxy", N)` em
`src/index.ts`. Valor errado pra menos = todo mundo com o IP do proxy
(limite global); pra mais = cliente forja o IP no header.

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
`cancelEnrollment`, `updateClassSessionWithRebalance`) segue esse mesmo formato:
`withSerializableRetry(() => prisma.$transaction(async (tx) => { ... }, { isolationLevel: Serializable }))`.
Uma função nova que lê-then-escreve com uma invariante a proteger (capacidade,
unicidade, etc.) deve seguir o mesmo padrão, não um `prisma.enrollment.create`
solto fora de transação.

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
padrão com `GOOGLE_CLIENT_ID` (`GoogleLoginNotConfiguredError`). Assim um ambiente sem a configuração — um dev novo, um
preview — não quebra o resto da API. Siga o mesmo padrão para qualquer
integração externa opcional: checa a configuração uma vez no carregamento
do módulo, lança um erro próprio na hora do uso.

`sendPushNotification(payload, where)` é o ponto único de envio: recebe um
filtro do Prisma para escolher os aparelhos e já apaga as inscrições que o
serviço de push responde como expiradas (404/410).
