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
  **convidado** só pelo nome (`guestName`) — inscrito pelo admin ou se
  inscrevendo sozinho, sem conta — sempre exatamente um dos dois. Mais um lado da quadra (`LEFT`/`RIGHT`) e um
  status (`CONFIRMED` ou `WAITLISTED`). Um usuário tem no máximo uma
  inscrição por turma (uma segunda tentativa responde `409`); convidados
  não têm essa trava (dois "João" convidados podem coexistir).

## Autenticação e identificação

**Login só com Google**, para aluno e admin — não existe usuário/senha,
tela de cadastro nem seed de admin. O botão "Fazer login com o Google"
leva a página ao Google, que devolve o login ao backend
(`POST /api/auth/google/callback`); o backend valida o token contra
`GOOGLE_CLIENT_ID` (só aceita e-mail verificado), confere que o login foi
pedido **por aquele mesmo navegador** (uma tentativa de uso único que vale
10 minutos — fora disso, "A tentativa de login expirou, tente de novo") e
faz upsert do `User` pelo id da conta Google:

- **Primeiro login** cria a conta com nome, e-mail e foto do Google.
- **O e-mail não fica em texto no banco**: só um hash (pra comparar) e
  uma cópia criptografada (pra mostrar no perfil do próprio usuário). A
  busca do admin não mostra e-mail e acha por pedaço do nome ou pelo
  e-mail **completo**, nunca por pedaço do e-mail.
- **Logins seguintes** atualizam e-mail e foto (a foto é a URL do Google,
  não guardamos arquivo), mas **não** o nome — o nome é editável pelo
  próprio usuário e o que ele escolheu prevalece.
- **Papel recalculado a cada login e a cada renovação de sessão:**
  `ADMIN` se o e-mail está em `ADMIN_EMAILS` (env do backend, lista
  separada por vírgula, sem diferenciar maiúsculas), senão `STUDENT`.
  Tirar um e-mail da lista rebaixa a conta na próxima renovação — em até
  5 minutos, o tempo de vida do access token em uso —, sem precisar que a
  pessoa saia e entre de novo. Toda mudança de papel fica no log do
  backend.
- **E-mail já usado por outra conta Google:** se uma conta Google nova
  chega com um e-mail que já pertence a outro usuário cadastrado, o login
  é recusado (`409`, "Este e-mail já está vinculado a outra conta
  Google") — não se mescla nem se sobrescreve conta.

**O que exige login:**

- **Público (sem login):** ver datas, turmas, vagas, nomes dos inscritos e
  a lista de espera — só os nomes: a visão pública não diz quem é
  convidado nem mostra comprovantes. E **se inscrever como convidado**, só
  com nome e lado (ver "Convidado sem conta" abaixo).
- **Qualquer usuário logado:** se inscrever, cancelar a própria inscrição,
  ver "minhas aulas" e enviar comprovante — sempre **da própria conta**: a
  identidade vem da sessão, nunca de um nome digitado. Comprovante só é
  aceito para inscrição do próprio usuário (de outro, ou de convidado,
  responde `404`). Sem sessão, essas rotas respondem `401`. "Minhas aulas"
  e o perfil mandam pro login e voltam pra mesma tela depois; as telas do
  admin, logado como aluno, voltam pra tela inicial.
- **Só admin:** criar/editar/remover turma, remover inscrição, inscrever
  alguém (um usuário cadastrado, escolhido por busca de nome/e-mail, ou um
  convidado pelo nome), ver os comprovantes e quem é convidado nas turmas,
  e aprovar/negar comprovante. Sem sessão `401`; com sessão de aluno `403`.

**Convidado:** inscrição só com um nome, para quem não tem (ou não quer)
conta — feita pelo admin ou pela própria pessoa (abaixo). Ocupa vaga e
entra na fila igual a qualquer inscrição, mas não recebe notificação e não
tem tela de comprovante (o pagamento é tratado por fora com o professor).
O admin remove qualquer convidado.

**Convidado sem conta (auto-inscrição):** na tela pública, quem não está
logado clica "Quero participar" e preenche **nome e lado** (o lado é
escolhido a cada inscrição, já que não há perfil; o aparelho lembra o
último nome/lado pra pré-preencher). O convite pra criar a conta vem
depois da inscrição (ver "Convite para criar conta e instalar o app"). A
inscrição segue as
mesmas regras de vaga por lado, lista de espera e aviso de lista trancada.

- **Cancelar só pelo mesmo aparelho:** a inscrição devolve um código
  secreto, guardado no navegador (o banco guarda só o hash dele). Com o
  código, o aparelho mostra "você está inscrito/na lista de espera" no card
  da turma e oferece "Cancelar minha vaga" — respeitando a trava, como o
  aluno logado. Outro aparelho, ou dados do navegador apagados, perde o
  código: aí só o admin remove. Convidado inscrito pelo admin nunca tem
  código.
- **Sem trava de duplicidade:** como todo convidado, o mesmo nome pode se
  inscrever mais de uma vez na turma. Quem se inscreveu sem conta e depois
  loga continua vendo a vaga de convidado naquele aparelho (não vira
  inscrição da conta).
- **Limite por IP:** inscrição e cancelamento de convidado aceitam 60
  tentativas por IP a cada 15 minutos (folgado: a turma pode estar toda no
  Wi-Fi da arena), só pra segurar um loop enchendo turmas de nomes falsos.

**Nome exibido = `User.name` atual** (join, não cópia): trocar o nome no
perfil muda o nome em todas as listas, inclusive em turmas passadas.
Convidado aparece com o nome digitado pelo admin; a etiqueta "convidado"
aparece **só na visão do admin**.

### Perfil

Todo usuário logado tem uma página de perfil (`/perfil`, aberta pela foto
no cabeçalho) com a foto do Google, o **nome editável** (1 a 100
caracteres, espaços nas pontas removidos), o e-mail (só leitura — vem do
Google), as notificações do aparelho e o botão de sair. O nome escolhido
ali nunca é sobrescrito pelo Google nos logins seguintes; a foto, sim.

### Sessão

**Uma sessão por aparelho/navegador** — logar no celular não derruba o
computador, e o Safari e o app instalado no iPhone (que não compartilham
cookies) ficam logados ao mesmo tempo. Login devolve dois JWTs em cookies
`httpOnly` — access token (5 minutos) e refresh token. O backend guarda,
por sessão, o identificador vigente de cada token, então toda rota
protegida confere que o access token ainda é o da sessão — sair revoga de
fato, não é só limpar cookie no navegador.

- **Renovação automática:** quando o access token expira, o front chama
  `POST /api/auth/refresh` e recebe um par novo sem pedir login de novo.
  Cada renovação troca o par daquela sessão (o par anterior deixa de
  valer) e estende a validade do refresh. Duas renovações quase
  simultâneas da mesma sessão (duas abas, ou o app do iPhone voltando do
  segundo plano no meio de uma renovação) não derrubam a sessão: por 10
  segundos o refresh anterior ainda é aceito. Um refresh já trocado
  apresentado depois disso é tratado como token copiado: a sessão daquele
  aparelho é encerrada (a pessoa entra de novo).
- **O login só conclui no navegador que o pediu.** Se o Google devolver o
  login num navegador diferente (com outros cookies), ele é recusado como
  tentativa expirada — não existe "concluir o login em outro aparelho".
- **Validade do refresh por papel:** aluno **90 dias**, admin **30 dias**
  — contados da última renovação. Quem abre o app pelo menos uma vez
  nesse prazo nunca precisa logar de novo; o prazo menor do admin limita
  um aparelho esquecido logado com acesso administrativo.
- **Sair** encerra só a sessão daquele aparelho/navegador; as dos outros
  aparelhos continuam. Antes de encerrar, o app desativa as notificações
  push daquele aparelho (sem bloquear a saída se isso falhar).

Verificação/aprovação de comprovante continua sendo feita por uma pessoa
(não é verificação automática de pagamento).

## Vagas por lado, não por turma

A capacidade de uma turma é dividida ao meio entre os dois lados da quadra:
`capacidadePorLado = Math.floor(capacidade / 2)`. Os dois lados enchem (e
entram em lista de espera) **independentemente** — uma turma com 4 vagas
confirmadas de um lado e 2 de espera do outro é um estado normal.

O lado é um dado do **usuário**, não de cada inscrição: o usuário escolhe uma
vez no /perfil (`User.preferredSide`) e toda inscrição dele — feita por ele
ou pelo admin — entra nesse lado. Quem ainda não escolheu não pode ser
inscrito (`409`): o login e o "Quero participar" (logado) mandam para o
/perfil primeiro. O lado pode ser trocado no perfil (para quem marcou errado), mas
não volta a ficar vazio, e a troca vale só para as próximas inscrições — as
já feitas continuam no lado em que foram feitas. Só o **convidado** (sem
conta) tem o lado escolhido na hora — pelo admin, ou por ele mesmo na
auto-inscrição.

Se o lado já tem `capacidadePorLado` confirmados, a inscrição nasce
`WAITLISTED` nesse lado, não `CONFIRMED`.

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

- **O aluno que já está inscrito (logado ou convidado sem conta) não
  consegue mais cancelar a própria vaga.** A tentativa de auto-cancelamento é rejeitada (API responde
  `409`); a inscrição continua exatamente como estava.
- **O admin continua podendo remover qualquer inscrição** (inclusive de
  convidado) e inscrever alguém (um usuário cadastrado ou um convidado
  pelo nome, e o lado), turma trancada ou não — a trava só vale pro
  auto-cancelamento do aluno. Remover um confirmado promove o próximo da
  fila daquele lado, como qualquer outra vaga liberada.
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

## Notificações (push)

Notificação push no aparelho (Web Push; no iPhone, só com o app adicionado
à tela de início). Cada aparelho ativa as notificações **para a conta
logada** nele — a sessão identifica o dono, não um nome digitado. Um
aparelho pertence a uma conta por vez: outra pessoa logando nele assume as
notificações; sair da conta (logout) desativa as notificações daquele
aparelho. Uma conta pode ter vários aparelhos, e todos recebem.

**Quem recebe:** só inscrições de usuário (`userId`). **Convidado nunca
recebe** — não tem conta nem aparelho.

**Quando:**

- **Saiu da lista de espera → confirmado** (por cancelamento de outro
  aluno, remoção pelo admin ou aumento de capacidade): avisa quem foi
  promovido. Abre "Minhas aulas".
- **Voltou de confirmado para a lista de espera** (o admin reduziu a
  capacidade e ele estava entre os últimos confirmados a entrar): avisa
  quem foi rebaixado. Abre "Minhas aulas".
- **Admin removeu a inscrição:** avisa o aluno removido (confirmado ou na
  espera). Abre o início.
- **Admin excluiu a turma:** avisa todos os inscritos dela (confirmados e
  na espera). Abre o início.
- **Lembrete de cobrança:** a aula terminou e o comprovante não foi
  enviado — avisa cada inscrito **confirmado** sem comprovante (ver
  abaixo). Abre "Minhas aulas".
- **Turmas abertas:** disparado à mão pelo admin (ver abaixo) — avisa
  **todos** os aparelhos com notificação ativa. Abre o início.

Os quatro primeiros saem na hora da mudança e só se a aula ainda não
terminou (mexer numa turma antiga não avisa ninguém). O texto sempre traz
o nível, o dia (dd/mm) e o horário da aula. Falha no envio nunca desfaz a
inscrição/remoção — o aviso é "melhor esforço".

### Lembrete de cobrança

- **No máximo uma vez por inscrição**, depois do horário de término da
  aula (horário de Brasília). Enviar o comprovante antes do lembrete
  cancela o lembrete.
- Só aulas que terminaram **nas últimas 24h**: nunca chega cobrança de
  aula antiga (ex: quem ativa as notificações hoje não recebe lembrete de
  aulas de semanas atrás).
- A inscrição é dada como lembrada **mesmo se o aluno não tiver nenhum
  aparelho com notificação ativa** naquele momento — o lembrete é do fim
  da aula, não fica guardado pra quando ele ativar. Se o envio falhar por
  instabilidade do serviço de push, o lembrete é tentado de novo no
  próximo disparo (ainda dentro das 24h).
- **Produção:** um cron externo (cron-job.org) chama
  `POST /api/jobs/receipt-reminders` às **7:30, 8:30, 9:30 e 10:30**
  (America/Sao_Paulo) — as aulas são das 7h às 10h, então cada disparo
  pega as aulas que acabaram de terminar. Uma aula que termine depois do
  último disparo do dia é lembrada no das 7:30 seguinte (ainda dentro das
  24h). Chamar a rota de novo nunca repete aviso.
- **Dev local:** o próprio backend roda a mesma checagem a cada
  `RECEIPT_REMINDER_INTERVAL_MS`, se definido (desligado por padrão).

### Aviso de turmas abertas

- Botão **"Notificar alunos"** ao lado de "Turmas do dia", na tela do
  admin: anuncia as turmas da data selecionada ("As inscrições para as
  aulas de qui, 17/10 estão abertas"). Desabilitado se a data não tem
  turma; a API também recusa dia em que todas as turmas já terminaram.
- **Anti-spam:** se já houve um aviso **hoje** (horário de Brasília, de
  qualquer data anunciada), o botão abre um modal mostrando a hora e a
  data do último aviso e só envia de novo com "Notificar novamente". Cada
  disparo fica registrado (`ClassOpeningNotification`).
- Vai pra todo aparelho com push ativo (não depende de inscrição). Fica
  guardado até 12h se o celular estiver offline; dois avisos pendentes no
  mesmo aparelho viram um só (o mais recente).

### Como o aluno ativa

- No **perfil** (`/perfil`), card de notificações: ativar/desativar neste
  aparelho.
- **Convite** logo depois de se inscrever numa aula ("Quer ser avisado se
  sair da lista de espera ou na hora de enviar o comprovante?"), dentro do
  card da aula. Dispensável; não volta neste aparelho depois de dispensado
  ou ativado, e não aparece se o aparelho não suporta, bloqueou ou já
  ativou. No iPhone sem o app instalado, mostra como instalar.

## Convite para criar conta e instalar o app

Depois de uma **auto-inscrição de convidado** dar certo na tela pública,
aparece um pop-up que confirma a vaga (ou a lista de espera) e convida a
criar a conta com o Google (vai pro `/login` e volta pra mesma tela) e a
instalar o app.

- **No máximo uma vez a cada 24h por aparelho:** ao aparecer, grava um
  cookie que vence em 24h — fechar ou aceitar dá no mesmo. Enquanto o
  cookie vale, novas inscrições sem conta não mostram o pop-up.
- **Só convidado sem conta:** inscrição logada não mostra, e o admin
  inscrevendo um convidado (tela do admin) também não.
- **Instalação conforme o aparelho:** com o app já aberto pelo ícone, a
  parte de instalar some. No Chrome/Edge/Android que oferecem o pedido
  nativo, um botão "Instalar o app" abre esse pedido; aceito, avisa que
  pode vir uma verificação de segurança do Google e que o ícone fica na
  tela de início. Senão, no iPhone e
  no Android aparece o passo a passo em texto e um vídeo do sistema
  (`public/tutoriais/instalar-iphone.mp4` e `instalar-android.mp4`); no
  computador sem pedido nativo, nada. No iPhone, avisa que o app instalado
  não compartilha o login com o Safari.

## Fora de escopo (por enquanto)

- Cobrança/pagamento de fato — o aviso de "mediante pagamento" na trava de
  lista é só um aviso de texto, não existe integração de cobrança.
- Notificações por WhatsApp/e-mail, e os avisos push ainda não feitos:
  comprovante avaliado, novo comprovante pro admin, lembrete de trava de
  lista.
- Automação da criação semanal de turmas.
- Testes automatizados.
- Deploy/produção (os Dockerfiles são voltados para desenvolvimento local).
