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
`cancelEnrollment`, `removeEnrollmentById`,
`updateClassSessionWithRebalance`) segue esse mesmo formato:
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
