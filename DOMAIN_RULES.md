# Regras de domínio

Este documento descreve **como o produto se comporta**, independente de
onde/como está implementado. Para a organização do código em si, veja
`apps/backend/ARCHITECTURE.md` e `apps/frontend/ARCHITECTURE.md`.

## Modelo

- **`ClassSession`** (turma/aula): uma data, um horário (`startTime`/
  `endTime`, sempre 1h de duração), um nível (`Iniciante`/`Intermediário`/
  `Avançado`), uma capacidade (padrão 8, editável), e opcionalmente um
  horário de trava (`lockAt`).
- **`Enrollment`** (inscrição): um nome de aluno, um lado da quadra
  (`LEFT`/`RIGHT`), um status (`CONFIRMED` ou `WAITLISTED`).
- **Identificação só pelo nome, sem login.** Limitação aceita nesta fase —
  já é uma melhoria grande sobre uma lista de WhatsApp, mesmo não sendo à
  prova de falhas (nomes duplicados, ou digitados diferente na hora de
  cancelar, não são tratados).

## Autenticação administrativa

O aluno continua sem login (identificação só pelo nome, ver acima) — só o
admin precisa autenticar. Um `User` (usuário + senha com hash) no Postgres,
sem tela de cadastro: o usuário inicial é criado via `pnpm prisma:seed`
(lê `ADMIN_USERNAME`/`ADMIN_PASSWORD` do `.env`), não por um formulário de
signup. Login (`POST /api/auth/login`) devolve um JWT num cookie
`httpOnly`; as rotas administrativas (criar/editar/remover turma,
aprovar/negar comprovante) exigem esse cookie e
respondem `401` sem ele. `/admin` e `/admin/cobranca` no front redirecionam
pra `/login` quando a sessão não está autenticada.

O JWT expira em 5 minutos e carrega um `jti` (id de sessão aleatório).
`User.currentJti` guarda o `jti` da sessão vigente: login gera um novo e
grava; toda rota administrativa confere que o `jti` do cookie ainda bate
com o gravado no banco (`isAdminSessionActive`), então um logout (que
zera `currentJti`) ou um novo login em outro lugar invalida de fato
qualquer token anterior, mesmo antes de expirar — não é só limpar o
cookie no navegador. Verificação/aprovação por trás desse login continua
sendo feita por uma pessoa (não é verificação automática de pagamento).

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
- **O admin sempre pode remover uma inscrição manualmente**, trancada ou
  não — é a válvula de escape para exceções (ex.: aluno avisou que não vem
  e o admin decide liberar a vaga de qualquer forma).
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
