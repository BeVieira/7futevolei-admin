# Arquitetura de componentes (frontend)

Este documento define onde cada componente React deve viver neste projeto. O
critério é único: **quantas telas usam o componente**.

## Regra

- **Global** (usado por 2+ telas, ou é estrutura da aplicação como um todo): vai em `src/components/`.
- **Local** (usado por apenas uma tela): vai dentro da pasta da própria tela, em uma subpasta `components/`.

Se um componente local passar a ser usado por outra tela, promova-o para
`src/components/` nesse momento — não antes.

## Estrutura de pastas

```
src/
  components/            # componentes globais
    Button.tsx
    Card.tsx
    CollapsibleSectionHeader.tsx
    Layout.tsx
    index.ts             # barrel: reexporta tudo daqui

  pages/
    AdminPage/
      AdminPage.tsx       # componente da tela
      index.ts            # barrel: export { AdminPage } from "./AdminPage"
      components/         # componentes usados só pela AdminPage
        AdminClassSessionCard.tsx
        HorarioBlockEditor.tsx
        index.ts          # barrel: reexporta tudo daqui

    PublicPage/
      PublicPage.tsx
      index.ts
      components/
        ClassSessionCard.tsx
        SideSlots.tsx      # colaborador interno do ClassSessionCard
        index.ts           # reexporta só o que é usado fora da pasta

  assets/
    icons/                 # ícones SVG, compartilhados por qualquer tela
      index.ts
```

## Barrels (`index.ts`)

Cada pasta de componentes globais tem um `index.ts` que reexporta os componentes consumidos **de fora da pasta**. Regras práticas:

- Um arquivo fora da pasta de componentes locais sempre importa do barrel:
  ```ts
  import { Button, Card } from "../../components";
  ```

### Componentes Locais (`<Tela>/components/`)
- Um arquivo da pasta de componentes locais sempre importa diretamente, sem a necessidade de um arquivo _index.ts_ na pasta _<Tela>/components_:
  ```ts
  import { ClassSessionCard } from "./components/ClassSessionCard";
  ``` 

- Dentro da própria pasta, um componente pode importar um colaborador
  interno direto do arquivo, sem passar pelo barrel — evita import
  circular (o barrel reexporta o próprio arquivo que estaria importando
  dele). Exemplo: `ClassSessionCard.tsx` importa `SideSlots` via
  `import { SideSlots } from "./SideSlots"`, não via `"."`.
- Um colaborador interno que não é usado por nada fora da pasta (como
  `SideSlots`) **não precisa** entrar no barrel.



## Import de módulos que não são componentes

`utils/`, `domain/` e `assets/icons/` continuam na raiz de `src/`. Uma tela
dentro de `pages/<Tela>/` está um nível mais profundo que antes, então esses
imports usam `../../` em vez de `../`:

```ts
// dentro de src/pages/AdminPage/AdminPage.tsx
import { aulaService, TimeSlotInput, useGetClassesByDate } from "../../domain/aula";

// dentro de src/pages/AdminPage/components/AdminClassSessionCard.tsx
import { Card } from "../../../components";
import { ClassLevel } from "../../../domain/aula";
```

## Cores: tokens do Tailwind, nunca hex solto

`tailwind.config.js` define as cores da marca como tokens nomeados, não
usados via `bg-[#FBF6EA]` espalhado pelo código:

```js
colors: {
  background: "#FBF6EA", // fundo da tela
  card: "#FFFDF7",       // fundo de Card/Modal — mais claro que o fundo da tela, de propósito
  accent: {
    DEFAULT: "#D86E00",  // botão primário, destaques
    hover: "#B85D00",
    light: "#F0B573",    // estado disabled do botão primário
  },
},
```

Uso: `bg-background` na tela (`Layout.tsx`), `bg-card` em qualquer
superfície elevada (`Card`, `Modal`), `bg-accent`/`hover:bg-accent-hover`/
`disabled:bg-accent-light` no variant `primary` do `Button`. Uma cor nova
da marca vira token aqui antes de ser usada em qualquer componente — nunca
um hex literal numa className.

## Componentes que embrulham outros componentes: `Modal`

`components/Modal.tsx` é o wrapper genérico (backdrop, botão de fechar,
`bg-card`) — não sabe nada sobre o que renderiza dentro. Conteúdo
específico (lista de espera, calendário) é um componente **local** próprio
que usa `Modal` por composição, seguindo a mesma regra de global-vs-local
do resto do arquivo:

```ts
// pages/PublicPage/components/WaitlistModal.tsx — só essa tela usa
import { Modal } from "../../../components";
export function WaitlistModal(...) {
  return <Modal title="Lista de espera" onClose={onClose}>...</Modal>;
}
```

`CalendarModal` (seletor de data com indicação de dias com aula, em
`pages/AdminPage/components/`) segue o mesmo padrão.

## Checklist ao criar um componente novo

1. É usado por mais de uma tela? → `src/components/` + adicionar ao `index.ts` do barrel global.
2. É usado só por uma tela? → `src/pages/<Tela>/components/` + consumir diretamente na tela via `./components/<Componente>`.
3. É um colaborador interno de outro componente local, sem uso externo à
   pasta? → mesma pasta `components/` da tela
4. Ajuste os imports relativos considerando o nível extra de profundidade
   introduzido pela pasta da tela.

# Camada de domínio (`src/domain/`)

Toda lógica que não é puramente visual — chamadas de rede, regras de
negócio, orquestração de uma ação do usuário — sai dos arquivos `.tsx` e vai
para `src/domain/<dominio>/`. Um domínio é um substantivo do negócio:
`aula`, `enrollment`, `usuario`, etc. Cada domínio tem 4 partes **e um
`index.ts` que é a única porta de entrada para quem está fora da pasta** —
mesma regra dos componentes globais ("sempre exportamos via index"):

```
src/domain/
  queryKeys.ts        # enum + builders de queryKey, compartilhado entre domínios

  aula/
    types.ts           # shapes que vêm da API (e tipos derivados delas)
    api.ts              # chamadas HTTP cruas, uma função por endpoint
    service.ts           # espelha o api.ts 1:1 + funções puras de negócio
    useCases/             # uma ação da tela = um arquivo: função interna + hook
      getClassesByDate.ts    # useGetClassesByDate
      getClassById.ts        # useGetClassById
      createClassesForDay.ts # useCreateClassesForDay
      updateClass.ts         # useUpdateClass
      deleteClass.ts         # useDeleteClass
      index.ts               # barrel: reexporta só os hooks
    index.ts             # barrel do domínio: export * de types/api/service/useCases

  enrollment/
    types.ts
    api.ts
    service.ts
    useCases/
      enrollStudent.ts        # useEnrollStudent
      cancelMyEnrollment.ts   # useCancelMyEnrollment
      removeEnrollmentById.ts # useRemoveEnrollmentById
      index.ts
    index.ts             # barrel do domínio: export * de types/api/service/useCases
```

## Export de `api.ts`/`service.ts`: uma const no final do arquivo, não `export` espalhado

`api.ts` e `service.ts` não marcam cada função como `export` onde ela é
declarada. Toda função do arquivo é declarada **sem** `export`, e só ao
final do arquivo entra uma única const, nomeada `<dominio>Api`/
`<dominio>Service`, agrupando o que é público:

```ts
// domain/aula/api.ts
function getClassesByDate(date: string) { ... }
function getClassById(id: number) { ... }
// ...

export const aulaApi = {
  getClassesByDate,
  getClassById,
  // ...
};
```

```ts
// domain/aula/service.ts
import { aulaApi } from "./api";

function getClassesByDate(date: string) {
  return aulaApi.getClassesByDate(date);
}
// ...

export const aulaService = {
  getClassesByDate,
  // ...
};
```

Motivo: a superfície pública do módulo fica visível num único lugar (a
const no final), em vez de espalhada como um `export` por função no meio do
arquivo — para saber o que um arquivo expõe, basta olhar a const, não ler o
arquivo inteiro caçando `export`. Constantes internas usadas só dentro do
arquivo (`DEFAULT_LEVELS`, `STORAGE_KEY`, etc.) e helpers privados
(`readStorage`, `writeStorage`) continuam sem `export` e de fora da const —
só entra na const o que é de fato parte da API pública do módulo.

Isso vale para **todo arquivo novo de `api.ts`/`service.ts`** na camada de
domínio, a partir de agora — é o padrão a seguir daqui para frente.
`types.ts` fica de fora dessa regra (tipos não entram numa const em
runtime, continuam com `export type`/`export interface` individual). Os
**hooks de `useCases/` também ficam de fora** — cada arquivo já expõe só
um hook, então não há "export espalhado" para resolver ali, e eles
precisam sair soltos por serem chamados por nome direto pela tela (ver
próxima seção).

## Nunca `import *` — importe exatamente o que você for usar

Nenhum arquivo, dentro ou fora de `domain/`, importa um módulo inteiro como
namespace. Isso vale tanto para valor (`import * as api from "./api"`)
quanto para tipo (`import type * as aulaTypes from "./types"`) — os dois
são proibidos. O import lista, por nome, exatamente os símbolos usados
naquele arquivo:

```ts
// ❌ não faça isso
import * as api from "./api";
import type * as aulaTypes from "./types";
api.getClassById(id);
const level: aulaTypes.ClassLevel = "Iniciante";

// ✅ faça isso
import { aulaApi } from "./api";
import { ClassLevel } from "./types";
aulaApi.getClassById(id);
const level: ClassLevel = "Iniciante";
```

Motivo: um import nomeado é rastreável — `grep`/"find usages" no nome
importado mostra exatamente quem usa o quê. Um `import *` esconde isso
atrás de um namespace opaco montado só naquele arquivo, e some com a
distinção entre "isso é tipo" e "isso é valor" (que o `import type *`
também apagava). Essa regra vale mesmo quando o módulo importado só tem uma
única coisa pública (como `api.ts`/`service.ts` — ver seção acima): o
import continua nomeado (`import { aulaApi } from "./api"`), nunca `import
* as aulaApi from "./api"`.

## `export *`: OK no `index.ts` do domínio, porque cada arquivo já curou o que é público

Ao contrário do import, **`export *` é o padrão** no `index.ts` de cada
domínio — repassando tudo que cada arquivo interno já decidiu expor:

```ts
// domain/aula/index.ts
export * from "./types";
export * from "./api";
export * from "./service";
export * from "./useCases";
```

Isso é seguro porque a curadoria do que é público já aconteceu **um nível
abaixo**, em cada arquivo: `types.ts` só tem `export type`/`export
interface` para os shapes que devem ser públicos; `api.ts`/`service.ts` só
expõem a const única (`aulaApi`/`aulaService`) e tudo o mais no arquivo é
função/const sem `export`; `useCases/index.ts` só reexporta os hooks. Um
`export *` num arquivo assim não vaza nada de interno — ele só pode repassar
o que já foi deliberadamente marcado `export`. Por isso o `index.ts` do
domínio não precisa (e não deve) enumerar nomes ou namespacear com `export
* as X from`.

De fora do domínio (telas, outro domínio), o import é **sempre** pelo
`index.ts` raiz — nunca `domain/aula/service`, nunca `domain/aula/types`,
nunca `domain/aula/useCases` direto — e, seguindo a regra de import acima,
sempre nomeando exatamente o que é usado, nunca como namespace:

```ts
// dentro de src/pages/PublicPage/components/StudentClassSessionCard.tsx
import { aulaService, ClassSessionSummary, useGetClassById } from "../../../domain/aula";
import {
  enrollmentService,
  Side,
  useCancelMyEnrollment,
  useEnrollStudent,
} from "../../../domain/enrollment";

type Props = { session: ClassSessionSummary };
// aulaService.isClassFull(session), aulaService.getSideCapacity(session.capacity)
// enrollmentService.getMyEnrollmentName(session.id)
```

`aulaService`/`enrollmentService` são importados por nome como qualquer
outro símbolo — o fato de serem um objeto agrupando vários métodos (ver
seção anterior) não muda a regra de import, só significa que "o que se usa
daquele arquivo" já vem pré-agrupado num nome só.

**Dentro** da própria pasta do domínio (o `service.ts` chamando `api.ts`, um
`useCase` chamando `service.ts`), o import é **relativo direto**
(`import { aulaApi } from "./api"`, `import { aulaService } from "../service"`),
nunca através do `index.ts` do próprio domínio — senão vira import circular
(o `index.ts` reexporta `useCases/`, que importaria de volta o `index.ts`
que o contém). É a mesma regra já usada para colaboradores internos de
componentes locais.

## Nomeação: a função conta o que ela faz

Todo nome de ação — em `api.ts`, `service.ts` e `useCases/` — é um verbo +
o que está sendo afetado, deixando o parâmetro necessário óbvio pelo nome,
sem precisar abrir o arquivo:

- "Estou criando aulas para um dia" → `createClassesForDay(date, timeSlots)`
- "Estou pegando as aulas de uma data" → `getClassesByDate(date)`
- "Estou pegando uma aula pelo id" → `getClassById(id)`
- "Estou inscrevendo um aluno numa aula" →
  `enrollStudentInClass(classId, studentName, side)`
- "Estou cancelando pelo nome do aluno" →
  `cancelEnrollmentByStudentName(classId, studentName)`

Evite nomes genéricos (`update`, `fetchData`, `handleSubmit`) e payloads
opacos (`{ ...payload }`) quando os parâmetros nomeados deixam a assinatura
autoexplicativa.

## O que vai em cada arquivo

- **`types.ts`** — só os formatos de dados que a API devolve/recebe. Nada de
  tipo de `Props` de componente aqui.
- **`api.ts`** — um `fetch` por endpoint, sem regra de negócio. Só monta a
  request e devolve a resposta tipada, via `handleResponse` de
  `src/utils/http.ts`.
- **`service.ts`** tem duas categorias de função, e ambas podem ter o
  **mesmo nome** da função correspondente em `api.ts` — isso é esperado, não
  um code smell, porque a cadeia de chamada é estrita (ver seção abaixo):
  - **Espelho do `api.ts`**: uma função por chamada de rede, mesmo nome,
    corpo de uma linha (`return api.getClassById(id)`). Existe só para
    fechar a regra "só o `service` chama o `api`".
  - **Funções puras de negócio**: sem I/O, síncronas — agrupar aulas por
    horário, calcular capacidade de um lado da quadra, decidir o próximo
    nível padrão de quadra, etc.
- **`useCases/`** — uma pasta, um arquivo por ação que a tela dispara
  (criar, listar, cancelar, remover...). Cada arquivo tem **duas partes**,
  mas só uma é exportada:
  1. Uma função async **interna** (sem `export`), que chama `service.ts`
     (nunca `api.ts` direto) e é o **único** ponto que trata erro: captura
     qualquer coisa que o `service`/`api` jogue e relança um `Error` com
     mensagem amigável, via `toActionError` de `src/utils/errors.ts`.
  2. O hook React (`useXxx`), **exportado**, que embrulha essa função com
     `useQuery`/`useMutation` (`@tanstack/react-query`) — é o único jeito
     de a tela chegar nessa ação. A tela nunca vê a função async, só o
     hook:
  ```ts
  // domain/aula/useCases/getClassesByDate.ts
  async function getClassesByDate(date: string) {
    try {
      return await aulaService.getClassesByDate(date);
    } catch (err) {
      throw toActionError(err, "Erro ao carregar aulas");
    }
  }

  export function useGetClassesByDate(date: string) {
    return useQuery({
      queryKey: queryKeys.classes.byDate(date),
      queryFn: () => getClassesByDate(date),
      refetchInterval: LIVE_REFRESH_INTERVAL_MS,
    });
  }
  ```
  Mesmo um caso de uso que só repassa para o `service` (ex.:
  `getClassesByDate`) ganha seu arquivo — é o que garante que a tela nunca
  precisa de `try/catch`, `queryKey` manual, nem `useQuery`/`useMutation`
  crus (ver seção de telas, abaixo).

## `queryKeys.ts`: um enum central, não strings soltas

`src/domain/queryKeys.ts` — um arquivo só, compartilhado por **todos** os
domínios (não um por domínio), porque uma mutation de `enrollment` precisa
invalidar dados de `aula`, e as duas pontas têm que apontar pro mesmo
identificador:

```ts
export enum DomainQueryKey {
  Classes = "classes",
  ClassDetail = "class",
}

export const queryKeys = {
  classes: {
    all: [DomainQueryKey.Classes] as const,
    byDate: (date: string) => [DomainQueryKey.Classes, date] as const,
    detail: (id: number) => [DomainQueryKey.ClassDetail, id] as const,
  },
};
```

Nenhum hook monta `["classes", date]` na mão — todos usam
`queryKeys.classes.byDate(date)`. Ao adicionar a entidade de um novo
domínio, acrescente um `enum` member + uma entrada em `queryKeys` aqui,
nunca strings literais espalhadas pelos hooks.

## Regra de import entre as camadas

```
tela (.tsx) → hook do useCase (trata erro) → service.ts (espelho do api) → api.ts (fetch)
                                           ↘
                                             service.ts (funções puras) — tela também pode chamar direto
```

- **`api.ts`** só é chamado por **`service.ts`** — nunca por um caso de uso
  ou por uma tela diretamente.
- Das funções em **`service.ts`** que espelham o `api.ts` (fazem I/O), só o
  **hook do caso de uso correspondente** chama — a tela nunca chama, e nem
  a função async interna do caso de uso é exportada para fora do arquivo.
- Das funções **puras** de `service.ts` (sem I/O, sem chamada de rede), a
  tela pode chamar direto (via o objeto `aulaService`/`enrollmentService`
  importado do `index.ts` do domínio) — são leitura/transformação, não
  precisam de caso de uso nem de tratamento de erro.
- Um caso de uso pode compor lógica de outro domínio quando a ação cruza
  domínios. Exemplo: `enrollment/useCases/enrollStudent.ts` chama
  `enrollmentService.enrollStudentInClass` (efetiva a inscrição no backend)
  e depois `enrollmentService.rememberMyEnrollment` (lembra localmente o
  nome usado, via `localStorage`) — as duas chamadas, junto, são o "caso de
  uso" por trás do hook `useEnrollStudent`.

## Telas: `data`, `isLoading`, `isError` — nunca `useQuery`/`useMutation` cru

A tela não chama `@tanstack/react-query` diretamente, não monta `queryKey`
à mão, e não escreve `try/catch`. Ela só chama o **hook** exportado pelo
caso de uso e reage ao que ele devolve — o `QueryClientProvider` global
fica em `src/main.tsx`, mas isso é implementação, não algo que a tela
precisa saber:

```ts
const { data: sessions = [], isLoading, isError, error } = useGetClassesByDate(date);
```

```ts
const enrollMutation = useEnrollStudent(session.id);
// no JSX: enrollMutation.mutate({ studentName, side }), enrollMutation.isPending, enrollMutation.error?.message
```

- **Query keys** vivem em `domain/queryKeys.ts`
  (`queryKeys.classes.byDate(date)`, `queryKeys.classes.detail(id)`,
  `queryKeys.classes.all`) — nenhuma tela ou hook escreve o array da key à
  mão, evitando o key de uma tela não bater com o `invalidateQueries` de
  outro domínio.
- A invalidação de cache (o que recarrega depois de uma mutation) é
  responsabilidade do **hook do caso de uso**, não da tela: o `onSuccess`
  que chama `queryClient.invalidateQueries` mora dentro do
  `useEnrollStudent`/`useCreateClassesForDay`/etc., não em cada componente
  que os usa. Isso substitui a antiga prop `onChange` passada manualmente
  entre componentes.
- Estado de UI local que uma ação de sucesso precisa mexer (fechar um
  formulário, limpar um input) continua na tela — passe um `onSuccess` na
  **chamada** de `.mutate(vars, { onSuccess: ... })`; ele roda em conjunto
  com o `onSuccess` de invalidação já embutido no hook, não no lugar dele.
- `error` já vem tipado como `Error` porque todo caso de uso só lança
  `Error` (via `toActionError`) — a tela nunca precisa de
  `err instanceof Error ? ... : ...`.
- Um fetch disparado por clique (não por render), como o modal de lista de
  espera, também usa o hook de query — com a opção `{ enabled: <condição> }`
  passada pra ele, em vez de `useState` + `useEffect` manuais.
- Um dado que precisa parecer "ao vivo" (vagas mudando enquanto a tela está
  aberta) usa `refetchInterval` **dentro do hook do caso de uso** (ver
  `LIVE_REFRESH_INTERVAL_MS` em `src/utils/realtime.ts`), não em cada tela
  que o consome.

## Checklist ao criar uma funcionalidade nova de domínio

1. O dado vem do backend? → o formato entra em `types.ts` do domínio certo.
2. É uma chamada de rede nova? → função nova em `api.ts` (sem lógica) + a
   função espelho correspondente em `service.ts`.
3. É uma regra de negócio pura (cálculo, agrupamento, validação local)? →
   função nova em `service.ts`, sem espelho em `api.ts`.
4. É uma ação que a tela dispara (um clique, um submit)? → arquivo novo em
   `useCases/` com a função async **sem `export`** (`try/catch` +
   `toActionError`) e o hook `useXxx` **exportado**
   (`useQuery`/`useMutation`, com `queryKey` vindo de `domain/queryKeys.ts`
   e a invalidação no `onSuccess`) — só o hook entra no `useCases/index.ts`.
5. Na tela, uma ação de I/O (item 2/4) entra via o **hook** importado do
   `index.ts` raiz do domínio — nunca `api.ts`, nunca o espelho de
   `service.ts`, nunca `useQuery`/`useMutation` cru, nunca `try/catch`
   manual, nunca um import de subpasta (`domain/aula/service`,
   `domain/aula/useCases`, etc.). Uma leitura pura (item 3) é chamada via
   o objeto `aulaService`/`enrollmentService`, também importado do
   `index.ts` raiz do domínio.
