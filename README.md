# 7Futevolei Admin

Monorepo (pnpm workspaces) com backend Express + TypeScript, frontend React + Vite + TypeScript + Tailwind, PostgreSQL via Prisma, tudo orquestrado com Docker Compose e hot-reload.

Sistema de gestão de aulas extraordinárias de futevôlei: o admin cria o dia de aulas (gera as turmas em lote) e o aluno se inscreve digitando só o nome (sem login), entrando na lista de espera quando a turma lota.

## Pré-requisitos

- WSL2 com Docker Desktop integrado (ou Docker Engine instalado direto no WSL).
- Projeto clonado dentro do filesystem nativo do WSL (ex: `/home/<usuario>/projects/...`), **não** em `/mnt/c/...` — isso deixa o hot-reload lento/instável.
- Não é necessário Node/pnpm instalados localmente: tudo roda em container.
- Todos os comandos abaixo devem ser executados de dentro de um terminal WSL (bash), nunca PowerShell/CMD.

## Como rodar

1. Copie os arquivos de exemplo de variáveis de ambiente:

   ```bash
   cp apps/backend/.env.example apps/backend/.env
   cp apps/frontend/.env.example apps/frontend/.env
   ```

2. Suba os serviços:

   ```bash
   docker compose up --build
   ```

3. Rode as migrations do Prisma dentro do container do backend:

   ```bash
   docker compose exec backend pnpm prisma:migrate
   ```

4. Crie o usuário admin inicial (lê `ADMIN_USERNAME`/`ADMIN_PASSWORD` de
   `apps/backend/.env` — ajuste antes de rodar se quiser outra senha):

   ```bash
   docker compose exec backend pnpm prisma:seed
   ```

## URLs

- Página pública (aluno): http://localhost:5173
- Página admin: http://localhost:5173/admin (exige login — ver abaixo)
- Backend: http://localhost:3333
- Documentação da API (Swagger UI): http://localhost:3333/docs
- Postgres: localhost:5432

## Funcionalidades

### Aluno (página pública, `/`)

- Escolher a data e ver as turmas cadastradas naquele dia, agrupadas por
  horário (cada horário é uma seção colapsável).
- Ver, por turma: nível, vagas ocupadas/total, e o preenchimento de cada
  lado da quadra (esquerda/direita) vaga a vaga.
- Se inscrever informando nome e lado da quadra — entra confirmado, ou em
  lista de espera automaticamente se aquele lado já estiver cheio.
- Ver quem está na lista de espera de uma turma (nome + lado), num modal.
- Entrar na lista de espera diretamente por esse modal.
- Cancelar a própria inscrição — enquanto a lista da turma não estiver
  trancada (ver regra de trava abaixo).
- Ao se inscrever numa turma já trancada, ver um aviso explícito de que
  não poderá mais desistir e precisa confirmar ciência antes de prosseguir.
- Ver a badge "Lista trancada" numa turma, e a contagem de vagas/lista de
  espera atualizando sozinha em segundo plano (sem precisar recarregar a
  página).

### Admin (`/admin`, login em `/login`)

- Login com usuário/senha (`User` no Postgres, sem tela de cadastro — o
  usuário inicial é criado via `pnpm prisma:seed`); sessão guardada num
  cookie `httpOnly`. `/admin` e `/admin/cobranca` redirecionam pra
  `/login` sem sessão válida.
- Escolher a data via um calendário em modal, com um indicador visual nos
  dias que já têm turma cadastrada.
- Criar o dia de aulas em lote: um ou mais horários, cada um com uma ou
  mais quadras (até 3), cada quadra com seu próprio nível.
- Definir um horário de trava de lista (opcional) na criação em lote —
  vale para todas as turmas criadas naquela leva.
- Editar uma turma já criada: nível, capacidade e horário de trava.
  Mudar a capacidade reencaixa confirmados/lista de espera automaticamente
  (ver `DOMAIN_RULES.md`).
- Remover uma turma inteira.
- Ver a lista de confirmados e de espera de cada turma, com o lado de
  cada aluno.
- Remover uma inscrição manualmente — funciona mesmo com a lista trancada
  (é a exceção administrativa à trava).

Regras de negócio detalhadas (vagas por lado, promoção da fila, trava de
lista, fuso horário) estão em [`DOMAIN_RULES.md`](./DOMAIN_RULES.md).

## Modelo de dados

- `ClassSession`: uma turma (data, horário, nível/quadra, capacidade,
  horário de trava opcional).
- `Enrollment`: uma inscrição de aluno numa turma, com status `CONFIRMED` ou `WAITLISTED`.

A lógica de vagas/lista de espera (inscrever, cancelar, promover o próximo da fila, trancar) vive em `apps/backend/src/lib/enrollment-service.ts` e `class-session-lock.ts`, usando transações `Serializable` para evitar que duas inscrições simultâneas estourem a capacidade da turma.

## Estrutura do backend

Camadas em `apps/backend/src`: `routes/` (Express + doc OpenAPI) →
`controllers/` (um handler por endpoint) → `schemas/` (validação Zod) →
`lib/` (regra de negócio + utilitários compartilhados). Detalhes, padrão de
erro, transações e o fluxo de migração do Prisma estão em
[`apps/backend/ARCHITECTURE.md`](./apps/backend/ARCHITECTURE.md).

## Estrutura do frontend

Em `apps/frontend/src`: `components/` (globais, usados por 2+ telas) e
`pages/<Tela>/components/` (locais); `domain/<entidade>/` (`aula`,
`enrollment` — cada um com `types`/`api`/`service`/`useCases`, exportado só
pelo `index.ts` do domínio); `utils/` (helpers genéricos: data, formatação,
http, erros, polling); `assets/icons/`. O padrão completo — barrels,
camadas do domínio, hooks do React Query — está em
[`apps/frontend/ARCHITECTURE.md`](./apps/frontend/ARCHITECTURE.md).

## Fora de escopo (por enquanto)

Ver a lista completa em [`DOMAIN_RULES.md`](./DOMAIN_RULES.md#fora-de-escopo-por-enquanto) — em resumo: cobrança de fato, notificações, automação de criação semanal, testes automatizados e deploy de produção.
