# Plano: Comprovantes de pagamento ("Minhas aulas" + "Cobrança" do admin)

Este plano cobre duas features que se encaixam no mesmo conceito de domínio
novo — **comprovante de pagamento por inscrição** — vistas por dois ângulos:
o aluno (`/minhas-aulas`) e o admin (`/admin/cobranca`). Segue as convenções
já estabelecidas em `DOMAIN_RULES.md`, `apps/backend/ARCHITECTURE.md` e
`apps/frontend/ARCHITECTURE.md` — não inventa padrão novo onde um já existe.

## Decisões já tomadas com o usuário

- **Armazenamento do arquivo**: disco local do backend, via bind mount que
  já existe no `docker-compose.yml` (`./apps/backend:/app`) — não precisa de
  volume novo. Banco guarda só o caminho do arquivo.
- **Reenvio de comprovante**: permitido. Um `Receipt` por `Enrollment`
  (relação 1–1), sobrescrito a cada reenvio — não vira histórico de N
  arquivos.
- **Fila do admin**: turmas cuja data/horário já passaram; confirmados **e**
  lista de espera entram (ajustável depois, conforme o próprio usuário
  observou).

## Suposições que assumi sozinho (sinalize se quiser mudar)

Essas eu decidi para poder desenhar algo concreto, mas não foram
confirmadas explicitamente — é aqui que "na dúvida, pergunte" fica registrado
por escrito em vez de eu escolher calado:

1. **Reenvio só é oferecido quando não há comprovante ainda, ou quando o
   status é `REJECTED`.** Enquanto está `PENDING` (aguardando avaliação), a
   tela não oferece trocar o arquivo — evita o admin avaliar um arquivo que
   troca debaixo dele. Se quiser permitir substituir mesmo em `PENDING`,
   é a mesma rota, só muda a condição no front.
2. **"Meu nome" na aba Minhas Aulas é um conceito novo**, separado do que já
   existe hoje (`enrollment/service.ts` lembra o nome **por turma**, em
   `localStorage["7futevolei:my-enrollments"]`). Minhas Aulas precisa de um
   nome **global do aparelho** (mesmo nome usado em todas as inscrições),
   guardado numa chave nova (`7futevolei:my-name`). Na primeira visita, pede
   o nome; depois lembra. Tem um link "trocar nome" para resetar (dispositivo
   compartilhado, ou o aluno errou a digitação em alguma inscrição).
3. **Upload aceita imagem ou PDF, até 5MB.** Limite arbitrário de MVP — sem
   requisito explícito, então usei algo razoável para comprovante de
   pagamento (print de PIX, foto de recibo).
4. **Sem autenticação no acesso ao arquivo enviado** (`/uploads/...` fica
   público, como o resto da API). Consistente com a limitação já documentada
   em `DOMAIN_RULES.md` ("Fora de escopo: Autenticação/autorização") — não
   introduz um padrão de segurança que o resto do app não tem.
5. **A fila do admin não é um endpoint novo "pendências globais"** — reaproveita
   a navegação por data que o `AdminPage` já tem hoje
   (`useGetClassesByDate` + `useGetClassById`). O admin escolhe uma data já
   passada e vê os comprovantes das turmas daquele dia. Mais simples que
   inventar uma segunda forma de navegar, e mantém o front consistente.

---

## 1. Modelo de dados

```prisma
enum ReceiptStatus {
  PENDING
  APPROVED
  REJECTED
}

model Receipt {
  id           Int           @id @default(autoincrement())
  enrollment   Enrollment    @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  enrollmentId Int           @unique
  filePath     String        // relativo, ex: "uploads/receipts/enrollment-42-<hash>.jpg"
  mimeType     String
  status       ReceiptStatus @default(PENDING)
  adminComment String?       // obrigatório quando REJECTED, validado no schema Zod, não no banco
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}
```

E em `Enrollment`, a volta da relação:

```prisma
model Enrollment {
  // ...campos existentes
  receipt Receipt?
}
```

`enrollmentId @unique` é o que força o "1 comprovante por inscrição,
sobrescrito no reenvio" — resolve a decisão 2 sem precisar de uma tabela de
histórico.

Migração: `docker compose exec backend pnpm prisma:migrate` (nome sugerido:
`add_receipt`), conforme o processo já documentado em
`apps/backend/ARCHITECTURE.md`.

---

## 2. Backend

### 2.1 Upload: Multer + disco local

- Adicionar dependência `multer` (+ `@types/multer`) em
  `apps/backend/package.json`.
- Nova pasta `apps/backend/uploads/receipts/` (com um `.gitkeep`) — já fica
  persistida porque `docker-compose.yml` já bind-monta `./apps/backend:/app`
  inteiro, não precisa de volume adicional.
- `.gitignore` (raiz) ganha uma entrada para não versionar os arquivos
  enviados: `apps/backend/uploads/*` com exceção do `.gitkeep`.
- `src/index.ts` ganha `app.use("/uploads", express.static(path.join(__dirname, "../uploads")))`.
- Middleware Multer configurado com `diskStorage` (destino
  `uploads/receipts/`, filename `enrollment-${enrollmentId}-${Date.now()}${ext}`),
  `limits: { fileSize: 5 * 1024 * 1024 }`, `fileFilter` aceitando só
  `image/*` e `application/pdf`.

### 2.2 `lib/receipt-service.ts` (novo)

Segue o padrão de `enrollment-service.ts`: uma classe de erro por regra,
nenhuma decisão de status HTTP aqui.

```ts
export class ReceiptNotFoundError extends Error { ... }

export async function submitReceipt(
  enrollmentId: number,
  file: { path: string; mimetype: string },
) {
  // 1. acha o enrollment (EnrollmentNotFoundError se não existir)
  // 2. se já existe um receipt pra esse enrollment: apaga o arquivo antigo
  //    do disco (fs.unlink) e faz update (novo filePath/mimeType,
  //    status volta pra PENDING, adminComment limpo)
  // 3. senão: create
}

export async function reviewReceipt(
  receiptId: number,
  status: "APPROVED" | "REJECTED",
  adminComment: string | undefined,
) {
  // update; ReceiptNotFoundError se não existir (P2025)
}
```

Não precisa do `withSerializableRetry`/`Serializable` que
`enrollment-service.ts` usa — aquele padrão existe para proteger a invariante
de capacidade por lado sob concorrência (duas pessoas disputando a última
vaga). Aqui não há invariante compartilhada disputada por dois atores ao
mesmo tempo: o pior caso de concorrência é o próprio aluno reenviando duas
vezes seguidas, o que não corrompe nada. Uma nota rápida no arquivo explica
por que foge do padrão, para não parecer descuido.

### 2.3 Rotas novas, aninhadas em `class-session.routes.ts`

Comprovante pertence a uma inscrição específica de uma turma específica —
mesma lógica de aninhamento que `enrollments/:enrollmentId` já segue:

```
POST  /api/class-sessions/:id/enrollments/:enrollmentId/receipt   (multipart, campo "file")
PATCH /api/class-sessions/:id/enrollments/:enrollmentId/receipt   (admin aprova/nega)
```

`schemas/receipt.schema.ts`:

```ts
export const reviewReceiptSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    adminComment: z.string().min(1).optional(),
  })
  .refine((d) => d.status !== "REJECTED" || !!d.adminComment, {
    message: "adminComment is required when rejecting",
    path: ["adminComment"],
  });
```

`controllers/receipt.controller.ts`: `submitReceipt` (valida `req.file`
presente, 400 se não) e `reviewReceipt` (valida body, 404 via
`ReceiptNotFoundError`, 400 via Zod).

### 2.4 Embutir `receipt` nas respostas de `ClassSession` existentes

`getClassSessionById` já faz `include: { enrollments: ... }` — muda para
`include: { enrollments: { include: { receipt: true } } }`, e
`serializeDetail` (em `class-session.controller.ts`) passa a incluir
`receipt` nos itens de `confirmed`/`waitlist`:

```ts
const confirmed = enrollments
  .filter((e) => e.status === "CONFIRMED")
  .map((e) => ({
    id: e.id,
    studentName: e.studentName,
    side: e.side,
    createdAt: e.createdAt,
    receipt: e.receipt
      ? {
          id: e.receipt.id,
          filePath: e.receipt.filePath,
          status: e.receipt.status,
          adminComment: e.receipt.adminComment,
        }
      : null,
  }));
```

Isso é o suficiente pra tela de Cobrança do admin funcionar reaproveitando
`GET /api/class-sessions/:id` — sem endpoint novo de "fila".

### 2.5 Endpoint novo, fora do aninhamento: "minhas inscrições" por nome

Esse é o único caso que não é sobre **uma** turma, e sim uma travessia
por nome do aluno em **todas** as turmas — não cabe no aninhamento de
`class-session.routes.ts`. Vira um recurso novo, seguindo "um arquivo por
recurso" do `ARCHITECTURE.md`:

`routes/enrollment.routes.ts` (novo), montado em `src/index.ts` como
`app.use("/api/enrollments", enrollmentRouter)`:

```
GET /api/enrollments?studentName=Fulano
```

`controllers/enrollment.controller.ts` → `listEnrollmentsByStudentName`:
mesmo matching que `cancelEnrollment` já usa (`equals` + `mode: "insensitive"`,
trim), `include: { classSession: true, receipt: true }`, ordenado por
`classSession.date desc`. Resposta:

```ts
[{
  enrollment: { id, side, status, createdAt },
  classSession: { id, date, startTime, endTime, classLevel },
  receipt: { id, status, adminComment, filePath } | null,
}]
```

---

## 3. Frontend

### 3.1 Domínio novo: `domain/receipt/`

Mesma estrutura de 4 partes que `aula`/`enrollment` já seguem:

- `types.ts`: `ReceiptStatus`, `Receipt`
- `api.ts`: `submitReceipt(classSessionId, enrollmentId, file: File)` (monta
  `FormData`, POST multipart), `reviewReceipt(classSessionId, enrollmentId, status, adminComment?)` (PATCH)
- `service.ts`: espelhos + `receiptStatusLabel(status)` (função pura:
  "Aguardando avaliação" / "Aprovado" / "Negado") + `getReceiptFileUrl(filePath)`
  (monta a URL completa a partir da env `VITE_API_URL`)
- `useCases/`:
  - `submitReceipt.ts` → `useSubmitReceipt(classSessionId, enrollmentId)` —
    invalida `queryKeys.classes.detail(classSessionId)` **e** a query de
    "minhas inscrições" (nova entrada em `queryKeys`, ver 3.2)
  - `reviewReceipt.ts` → `useReviewReceipt(classSessionId, enrollmentId)` —
    invalida `queryKeys.classes.detail(classSessionId)`

### 3.2 Extensão de `domain/enrollment/`

- `types.ts`: adiciona `receipt: ReceiptSummary | null` em `EnrollmentSummary`
  (reflete a mudança do backend em 2.4); novo tipo `MyEnrollmentSummary`
  (o shape do endpoint de 2.5).
- `api.ts`: `getEnrollmentsByStudentName(studentName)`.
- `service.ts`: mirror + funções de "meu nome global" (chave nova,
  **não** reaproveita `STORAGE_KEY` existente — ver suposição 2):
  ```ts
  const NAME_STORAGE_KEY = "7futevolei:my-name";
  export function getMyName(): string | null { ... }
  export function rememberMyName(name: string) { ... }
  export function forgetMyName() { ... }
  ```
- `useCases/getMyEnrollments.ts` → `useGetMyEnrollments(studentName)`, com
  `enabled: !!studentName`.
- `domain/queryKeys.ts`: novo member no enum (`MyEnrollments`) + builder
  `myEnrollments: (studentName: string) => [...]`.

### 3.3 Tela nova: `pages/MinhasAulasPage/`

Rota `/minhas-aulas`, link novo em `Layout.tsx` (ao lado de "Aulas"/"Admin").

- Sem nome salvo → formulário simples "Quem é você?" (input + botão),
  `rememberMyName` ao confirmar.
- Com nome salvo → `useGetMyEnrollments(myName)`, lista de
  `MyEnrollmentCard` (data/horário formatados com `utils/date.ts` já
  existente, nível, lado, status confirmado/espera) + link "trocar nome"
  (chama `forgetMyName`).
- `components/MyEnrollmentCard.tsx` (local, só essa tela):
  - sem `receipt` → formulário de upload (`useSubmitReceipt`)
  - `PENDING` → badge "Aguardando avaliação" + link pro arquivo enviado
    (via `getReceiptFileUrl`)
  - `APPROVED` → badge verde "Aprovado", somente leitura
  - `REJECTED` → badge vermelho "Negado" + `adminComment` visível + mesmo
    formulário de upload pra reenviar

### 3.4 Tela nova: `pages/AdminReceiptsPage/`

Rota `/admin/cobranca`.

- **Promover `CalendarModal`** de `pages/AdminPage/components/` para
  `src/components/` — passa a ser usado por 2 telas
  (`AdminPage` e `AdminReceiptsPage`), que é exatamente o gatilho que
  `apps/frontend/ARCHITECTURE.md` já define pra promoção de componente
  local → global. Atualizar os dois imports depois de mover.
- **Sub-nav "Turmas" / "Cobrança"**: componente novo `src/components/AdminTabs.tsx`
  (global, porque também é usado pelas 2 telas), dois `Link` do
  react-router pra `/admin` e `/admin/cobranca`, mesmo padrão visual de
  aba ativa que `Layout.tsx` já usa pro nav principal.
- Reaproveita `useGetClassesByDate(date)` + `aulaService.groupClassesByTimeSlot`
  (mesma lógica que `AdminPage.tsx` já tem) pra navegar por dia.
- Componente local novo `components/ReceiptReviewCard.tsx`: por
  `ClassSession` do dia, chama `useGetClassById(sessionId)` (hook que já
  existe) e lista `confirmed` + `waitlist` com o `receipt` embutido
  (2.4/3.2); cada linha mostra nome, lado, status do comprovante, e — se
  `PENDING` — botões "Aprovar" / "Negar" (negar abre um textarea inline
  pra justificativa, obrigatório antes de confirmar) via `useReviewReceipt`.

---

## 4. Ordem sugerida de implementação

1. Migração Prisma (`Receipt` + `Enrollment.receipt`).
2. Backend: `receipt-service.ts` → schema Zod → controller → rotas
   aninhadas → Multer + estático `/uploads` → `.gitignore` da pasta de
   uploads.
3. Backend: embutir `receipt` em `serializeDetail` (`class-session.controller.ts`).
4. Backend: `enrollment.routes.ts` + controller (endpoint "minhas inscrições").
5. Testar os 3 endpoints novos via Swagger (`/docs`) antes de mexer no
   front — mais rápido pra achar erro de schema/relação do que só depois
   de plugar UI.
6. Frontend: domínio `receipt/` + extensão de `enrollment/` (tipos, api,
   service, "meu nome").
7. Frontend: `MinhasAulasPage` + rota + nav.
8. Frontend: promover `CalendarModal`, criar `AdminTabs`, criar
   `AdminReceiptsPage` + `ReceiptReviewCard` + rota.
9. Testar os dois fluxos ponta a ponta rodando `docker compose up` (enviar
   comprovante como aluno, aprovar/negar como admin, ver a justificativa
   aparecer em Minhas Aulas).

## 5. Fora de escopo (herda as limitações já documentadas em `DOMAIN_RULES.md`)

- Autenticação — `/minhas-aulas` e `/admin/cobranca` seguem sem proteção,
  como o resto do app.
- Notificação ao aluno quando o admin avalia (WhatsApp/e-mail/push) — o
  aluno só sabe olhando a tela de novo.
- Integração de pagamento de fato — comprovante continua sendo só um
  arquivo que um humano avalia, não uma verificação automática.
- Histórico de comprovantes rejeitados — só o último envio fica salvo
  (decisão 1–1 da seção de modelo de dados).
