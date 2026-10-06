# Plano: login com Google + notificações por aluno

Duas frentes em paralelo sobre a base `feat/pwa-push` (PWA + push já
funcionando, ainda vinculado por nome). Segue as convenções de
`DOMAIN_RULES.md`, `apps/backend/ARCHITECTURE.md` e
`apps/frontend/ARCHITECTURE.md` — não inventa padrão novo onde já existe um.
Toda regra nova de produto entra no `DOMAIN_RULES.md`; toda regra nova de
organização de código entra no ARCHITECTURE.md correspondente, no mesmo
commit.

## Decisões já tomadas com o usuário

- **Login só com Google**, para aluno e admin. Some usuário/senha e o seed
  de admin. Admin = usuário cujo e-mail está em `ADMIN_EMAILS` (env do
  backend, lista separada por vírgula, comparação sem diferenciar
  maiúsculas); o papel é recalculado a cada login.
- **Banco será limpo** — não precisa migrar dados antigos. Pode dropar e
  recriar colunas/tabelas.
- **Convidado por nome continua existindo**, só via admin: uma inscrição
  tem `userId` **ou** `guestName` (exatamente um dos dois). Convidado não
  recebe notificação nem tem tela de comprovante. A etiqueta "convidado"
  aparece **só na visão do admin**; na tela pública aparece só o nome.
- **Ver aulas é público.** Inscrever, cancelar, ver "minhas aulas" e enviar
  comprovante exigem login. A tela "Quem é você?" (nome do aparelho em
  `localStorage`) deixa de existir; o nome vem do perfil.
- **Nome exibido = `User.name` atual** (join, não cópia): trocar o nome no
  perfil muda o nome em todas as listas.
- **Cabeçalho:** onde hoje está o link "Admin" passa a ser "Entrar". Logado,
  aparece a foto do Google em miniatura (círculo) que leva a `/perfil`. Link
  "Admin" só para `role = ADMIN`.
- **Perfil (`/perfil`):** foto do Google, nome editável, e-mail (só
  leitura), sair. A foto é a URL do Google, atualizada a cada login (não
  armazenamos arquivo).
- **Notificações ficam no perfil** (não ícone no cabeçalho — sino sugere
  caixa de entrada, que não existe) **+ um convite contextual** logo após a
  primeira inscrição do aluno ("Quer ser avisado se sair da lista de espera
  ou na hora de enviar o comprovante?"), dispensável e que não volta a
  aparecer depois de dispensado ou ativado.
- **Eventos de notificação desta rodada** (todos só para inscrições com
  `userId`):
  1. Saiu da lista de espera → confirmado.
  2. Removido da turma pelo admin, ou turma excluída.
  3. Lembrete de cobrança ao fim da aula: inscritos **confirmados** sem
     comprovante enviado, depois do `endTime` da aula.
- **Lembrete de cobrança via job idempotente**, não agendador interno:
  rota `POST /api/jobs/receipt-reminders` protegida por `CRON_SECRET`
  (header), marca `Enrollment.receiptReminderSentAt` pra nunca avisar duas
  vezes. Produção: cron externo (cron-job.org) às **7:30, 8:30, 9:30 e
  10:30** (America/Sao_Paulo) — as aulas são das 7h às 10h. Local: o
  próprio backend roda a mesma checagem a cada minuto se
  `RECEIPT_REMINDER_INTERVAL_MS` estiver definido (desligado por padrão).
- **Fora desta rodada:** comprovante avaliado, aviso de novo comprovante pro
  admin, lembrete de trava de lista (reaproveitará o mesmo esquema de job).
- **Escopo local.** Nada de deploy agora.

## Contrato compartilhado (Fase 0 — feita pelo Dev 1 antes do resto)

O Dev 2 só começa depois disto estar commitado em `feat/google-login`.

**Schema (`apps/backend/prisma/schema.prisma`)**

```prisma
enum UserRole { STUDENT ADMIN }

model User {
  id                Int      @id @default(autoincrement())
  googleId          String   @unique
  email             String   @unique
  name              String
  photoUrl          String?
  role              UserRole @default(STUDENT)
  currentJti        String?
  currentRefreshJti String?
  enrollments       Enrollment[]
  pushSubscriptions PushSubscription[]
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model Enrollment {
  // ... campos atuais, MENOS studentName, MAIS:
  user                  User?     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId                Int?
  guestName             String?
  receiptReminderSentAt DateTime?
  @@index([userId])
}

model PushSubscription {
  // ... campos atuais, MENOS studentName, MAIS:
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId Int
  @@index([userId])
}
```

"Exatamente um de `userId`/`guestName`" é garantido no service (e,
se quiser, um CHECK na migration). Uma migration nova; banco local
recriado com `prisma migrate reset`.

**Sessão (backend)**

- `POST /api/auth/google` `{ credential }` (ID token do Google Identity
  Services) → verifica com `google-auth-library` contra `GOOGLE_CLIENT_ID`,
  faz upsert por `googleId` (atualiza `email`, `photoUrl`, `role`; **não**
  sobrescreve `name` se o usuário já existe — o nome é editável), emite os
  mesmos cookies access/refresh de hoje. Payload do token: `{ sub: userId,
  role, jti }`.
- Refresh do aluno: validade longa (90 dias) — app instalado no celular não
  deve pedir login toda semana.
- Middlewares: `requireAuth` (qualquer usuário logado; põe
  `res.locals.user = { id, role }`) e `requireAdmin` (idem + `role ===
  ADMIN`, senão 403). `requireAdminAuth` atual some/é substituído.
- `GET /api/auth/me` → `{ id, name, email, photoUrl, role }`.
- `POST /api/auth/logout` continua invalidando o par de tokens.

**Ponto de extensão do logout (pro Dev 2):** o front, ao sair, precisa
desinscrever o push do aparelho *antes* de derrubar a sessão. O Dev 1 deixa
o logout do front chamando um hook/callback que o Dev 2 preenche (ex:
`pushService.disable()` best-effort, sem bloquear o logout se falhar).

## Dev 1 — login Google + perfil (`feat/google-login`)

1. **Fase 0** acima (schema, migration, sessão, middlewares, `/auth/google`,
   `/auth/me`). Commitar e reportar antes de seguir.
2. Inscrição/cancelamento/minhas-aulas/comprovante passam a usar o
   `userId` da sessão (nada de nome vindo do front para aluno). Admin
   inscrevendo alguém: escolhe um usuário cadastrado **ou** digita um nome
   de convidado.
3. `PATCH /api/users/me` `{ name }` (Zod, trim, 1–100).
4. Front: domínio `auth`/`user` reescrito pro Google (botão do GIS na
   `LoginPage`, `useGetMe`, logout), avatar no cabeçalho, página `/perfil`,
   remoção do fluxo "Quem é você?", rotas protegidas (`/minhas-aulas`,
   `/perfil` → redireciona pro login e volta depois; `/admin*` exige ADMIN).
   Deixar no perfil o espaço onde o Dev 2 encaixa o controle de
   notificações.
5. **Validar o login dentro do PWA instalado no iPhone.** iOS isola cookies
   e storage do app da tela de início em relação ao Safari, e popup de
   OAuth em modo standalone é frágil. Se o fluxo de popup do GIS não
   funcionar instalado, trocar pelo fluxo de redirect (`ux_mode:
   "redirect"` com `login_uri` no backend). Documentar a escolha.
6. Atualizar `DOMAIN_RULES.md` (seção de autenticação e identificação) e
   os ARCHITECTURE.md.

## Dev 2 — notificações por usuário (`feat/push-notifications`, a partir da Fase 0)

1. `POST /api/push/subscribe` e `/unsubscribe` passam a exigir
   `requireAuth`; o `userId` vem da sessão (o front não manda mais nome).
   Upsert por `endpoint` reatribui o aparelho ao usuário logado.
2. Disparos (best-effort: falha no push nunca derruba a operação de
   inscrição; disparar **depois** da transação commitar):
   - promoção da lista de espera (em `lib/enrollment-service.ts`);
   - remoção pelo admin e exclusão de turma (avisar antes de apagar, ou
     coletar os `userId` antes do delete).
   Textos em pt-BR, com data/horário da aula, e `url` levando pra tela
   certa.
3. Job de lembrete de cobrança (rota + `CRON_SECRET` + intervalo local
   opcional, ver decisões). Considerar fuso America/Sao_Paulo ao comparar
   `date` + `endTime` com o agora.
4. Front: `PushNotificationsControl` sem nome, usando a sessão; componente
   pronto pra ser encaixado no `/perfil`; convite contextual pós primeira
   inscrição; desinscrição no logout (ponto de extensão do Dev 1).
5. `.env.example`: `CRON_SECRET`, `RECEIPT_REMINDER_INTERVAL_MS`.
   `DOMAIN_RULES.md`: seção de notificações (quem recebe o quê, quando).

## Gestor

Revisa cada entrega (Fase 0, Dev 1, Dev 2) contra este plano e as regras
dos docs: questiona decisões, procura bugs (fuso, transação, corrida,
permissões, cookie no iOS), checa docs atualizados, devolve lista
priorizada de correções. Não escreve a implementação.

## Logística

- Cada dev trabalha num git worktree próprio, na sua branch. O Docker do
  usuário monta a pasta principal — **não mexer nos containers dele**.
  Validação nos worktrees: `tsc --noEmit`, `eslint`, `vite build`,
  `prisma validate`. Teste real (inclusive login com a conta Google do
  usuário) acontece na pasta principal depois da integração.
- `.env` não existe nos worktrees (gitignored): copiar de
  `/home/bernardo/projetos/7futevolei-admin/apps/*/.env` se precisar.
- Integração: `feat/google-login` e `feat/push-notifications` entram em
  `feat/pwa-push`, feita pelo orquestrador com revisão do gestor.
