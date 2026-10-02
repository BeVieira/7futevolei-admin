# Regras de domínio

Este documento descreve **como o produto se comporta**, independente de
onde/como está implementado. Para a organização do código em si, veja
`apps/backend/ARCHITECTURE.md` e `apps/frontend/ARCHITECTURE.md`.

## Modelo

- **`ClassSession`** (turma/aula): uma data, um horário (`startTime`/
  `endTime`, sempre 1h de duração), um nível (`Iniciante`/`Intermediário`/
  `Avançado`), uma capacidade (padrão 8, editável), e opcionalmente um
  horário de trava (`lockAt`).
- **`User`** (conta): criada no primeiro login com Google — nome, e-mail,
  foto do Google e papel (`STUDENT` ou `ADMIN`). Ver "Autenticação e
  identificação".
- **`Enrollment`** (inscrição): de um **usuário** (`userId`) **ou** de um
  **convidado** inscrito pelo admin só pelo nome (`guestName`) — sempre
  exatamente um dos dois. Mais um lado da quadra (`LEFT`/`RIGHT`) e um
  status (`CONFIRMED` ou `WAITLISTED`). Um usuário tem no máximo uma
  inscrição por turma (uma segunda tentativa responde `409`); convidados
  não têm essa trava (dois "João" convidados podem coexistir).

## Autenticação e identificação

**Login só com Google**, para aluno e admin — não existe usuário/senha,
tela de cadastro nem seed de admin. O front obtém um ID token do Google
(Google Identity Services) e manda pra `POST /api/auth/google`; o backend
valida o token contra `GOOGLE_CLIENT_ID` (só aceita e-mail verificado) e
faz upsert do `User` pelo id da conta Google:

- **Primeiro login** cria a conta com nome, e-mail e foto do Google.
- **Logins seguintes** atualizam e-mail e foto (a foto é a URL do Google,
  não guardamos arquivo), mas **não** o nome — o nome é editável pelo
  próprio usuário e o que ele escolheu prevalece.
- **Papel recalculado a cada login:** `ADMIN` se o e-mail está em
  `ADMIN_EMAILS` (env do backend, lista separada por vírgula, sem
  diferenciar maiúsculas), senão `STUDENT`. Tirar um e-mail da lista
  rebaixa a conta no próximo login (ou na próxima renovação de sessão,
  que relê o papel do banco — ver abaixo).

**O que exige login:**

- **Público (sem login):** ver datas, turmas, vagas, nomes dos inscritos e
  a lista de espera.
- **Qualquer usuário logado:** se inscrever, cancelar a própria inscrição,
  ver "minhas aulas" e enviar comprovante — sempre **da própria conta**: a
  identidade vem da sessão, nunca de um nome digitado. Comprovante só é
  aceito para inscrição do próprio usuário (de outro, ou de convidado,
  responde `404`). Sem sessão, essas rotas respondem `401`.
- **Só admin:** criar/editar/remover turma, remover inscrição, inscrever
  alguém (um usuário cadastrado ou um convidado pelo nome) e
  aprovar/negar comprovante. Sem sessão `401`; com sessão de aluno `403`.

**Convidado:** inscrição feita pelo admin só com um nome, para quem não
tem (ou não quer) conta. Ocupa vaga e entra na fila igual a qualquer
inscrição, mas não recebe notificação, não cancela sozinho (só o admin
remove) e não tem tela de comprovante.

**Nome exibido = `User.name` atual** (join, não cópia): trocar o nome no
perfil muda o nome em todas as listas, inclusive em turmas passadas.
Convidado aparece com o nome digitado pelo admin.

### Sessão

Login devolve dois JWTs em cookies `httpOnly` — access token e refresh
token — com `{ sub: userId, role, jti }`. O access token expira em 5
minutos; o refresh token expira em **90 dias** (o app instalado no celular
não deve pedir login toda semana) e cada renovação emite um novo, então
quem abre o app pelo menos uma vez a cada 90 dias não precisa logar de
novo. `User.currentJti`/`currentRefreshJti` guardam o `jti` vigente de
cada um: login gera os dois e grava; toda rota protegida confere que o
`jti` do access token ainda bate com o gravado no banco
(`isSessionActive`). Quando o access token expira, o front chama
`POST /api/auth/refresh` (cookie do refresh token, path restrito a
`/api/auth`) pra renovar a sessão sem pedir login de novo — a renovação
**sempre emite um par novo e invalida o par anterior** (o `jti` antigo de
cada token deixa de bater com o gravado no banco), então tanto o access
quanto o refresh token usados nessa renovação não servem mais depois
dela. O papel do token renovado vem do banco, não do token antigo. Logout
zera os dois campos, invalidando o par vigente de fato — não é só limpar
cookie no navegador. Verificação/aprovação de comprovante continua sendo
feita por uma pessoa (não é verificação automática de pagamento).

**Limitações aceitas:**

- **Uma sessão por conta.** Como só existe um par de `jti` por usuário,
  logar num segundo aparelho/navegador derruba a sessão do primeiro
  (inclusive Safari × app instalado no iPhone, que não compartilham
  cookies).
- Como o refresh rotaciona (invalida) o par anterior, duas abas renovando
  quase simultaneamente podem fazer uma delas perder a sessão (a segunda
  renovação chega com o refresh token que a primeira já invalidou) —
  nesse caso a aba afetada só precisa logar de novo.

## Vagas por lado, não por turma

A capacidade de uma turma é dividida ao meio entre os dois lados da quadra:
`capacidadePorLado = Math.floor(capacidade / 2)`. Os dois lados enchem (e
entram em lista de espera) **independentemente** — uma turma com 4 vagas
confirmadas de um lado e 2 de espera do outro é um estado normal.

Ao se inscrever, o aluno escolhe um lado; se esse lado já tem
`capacidadePorLado` confirmados, a inscrição nasce `WAITLISTED` nesse
lado, não `CONFIRMED`.

## Promoção da lista de espera (FIFO por lado)

Quando uma vaga confirmada de um lado libera — por cancelamento do aluno,
remoção pelo admin, ou aumento de capacidade — o **próximo da fila daquele
lado**, por ordem de inscrição (`createdAt` mais antigo primeiro), é
promovido a confirmado automaticamente. Nunca é escolhido por outro
critério (nível, ordem alfabética, etc.), e nunca cruza para o outro lado.

## Editar a capacidade de uma turma já existente reencaixa todo mundo

Mudar a capacidade de uma turma com inscritos dispara um reencaixe
imediato, lado a lado:

- **Aumentou a capacidade** → promove os mais antigos da lista de espera
  daquele lado, um por vaga aberta, até preencher ou esvaziar a espera.
- **Diminuiu a capacidade** → os **últimos confirmados a entrar** daquele
  lado (não os primeiros) voltam para a lista de espera, na quantidade
  necessária para caber na nova capacidade. Quem entrou primeiro tem
  prioridade de permanecer confirmado.

Isso acontece atomicamente junto com a mudança de capacidade — não é uma
ação separada que o admin precisa disparar.

## Trancar a lista (`lockAt`)

O admin pode definir um horário de corte por turma (o mesmo horário se
aplica a todas as turmas de uma criação em lote — "Criar dia de aulas").
Depois desse horário:

- **O aluno que já está inscrito não consegue mais cancelar a própria
  vaga.** A tentativa de auto-cancelamento é rejeitada (API responde
  `409`); a inscrição continua exatamente como estava.
- **O admin não remove inscrições manualmente** — não há essa opção na
  tela administrativa. O admin só pode inscrever alguém (um usuário
  cadastrado ou um convidado pelo nome, e o lado), turma trancada ou não.
- **Novas inscrições continuam funcionando normalmente** mesmo depois de
  trancada, incluindo cair em lista de espera — a trava só afeta
  cancelamento, não inscrição.
- Quem se inscreve numa turma **já trancada** vê um aviso explícito antes
  de confirmar: a partir daquele momento não vai poder cancelar e se
  compromete a participar, mediante pagamento, mesmo em caso de ausência
  — e precisa marcar uma confirmação explícita para prosseguir.
- `lockAt` é opcional. Sem ele, a turma nunca tranca — cancelamento sempre
  disponível.

### Fuso horário do `lockAt`

O horário que o admin digita (ex. "22:00") é **hora local do Brasil**
(America/Sao_Paulo, UTC-3 o ano todo — o país não observa horário de
verão desde 2019). Interno, a data da turma é guardada como meia-noite UTC
e o backend soma 3h ao horário digitado antes de comparar com o instante
atual, para alinhar corretamente com o horário real de Brasília. Sem esse
ajuste, "22:00" trancaria a lista 3h mais cedo do que o admin escolheu —
foi exatamente o bug corrigido nesta sessão. Se o servidor um dia rodar
fora do Brasil ou o app expandir para outro fuso, esse deslocamento fixo
(`BRAZIL_UTC_OFFSET_HOURS` em `apps/backend/src/lib/class-session-lock.ts`)
precisa virar configurável.

## Fora de escopo (por enquanto)

- Cobrança/pagamento de fato — o aviso de "mediante pagamento" na trava de
  lista é só um aviso de texto, não existe integração de cobrança.
- Notificações (WhatsApp/e-mail/push).
- Automação da criação semanal de turmas.
- Testes automatizados.
- Deploy/produção (os Dockerfiles são voltados para desenvolvimento local).
