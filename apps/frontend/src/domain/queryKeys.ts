export enum DomainQueryKey {
  Classes = "classes",
  ClassDetail = "class",
  MyEnrollments = "myEnrollments",
  Me = "me",
  GoogleSignIn = "googleSignIn",
  PushStatus = "pushStatus",
  Users = "users",
}

export const queryKeys = {
  auth: {
    me: [DomainQueryKey.Me] as const,
    googleSignIn: [DomainQueryKey.GoogleSignIn] as const,
  },
  classes: {
    all: [DomainQueryKey.Classes] as const,
    byDate: (date: string) => [DomainQueryKey.Classes, date] as const,
    detail: (id: number) => [DomainQueryKey.ClassDetail, id] as const,
    // Prefixo de todos os detalhes (públicos e do admin) de qualquer turma.
    allDetails: [DomainQueryKey.ClassDetail] as const,
    // Prefixada com `detail(id)` de propósito: toda mutation que invalida o
    // detalhe público de uma turma também invalida a visão do admin dela.
    adminDetail: (id: number) =>
      [DomainQueryKey.ClassDetail, id, "admin"] as const,
    // "month" prefixado com Classes de propósito: invalidar queryKeys.classes.all
    // (ex.: após criar um dia de aulas) também invalida os pontinhos do calendário.
    byMonth: (month: string) =>
      [DomainQueryKey.Classes, "month", month] as const,
    nextAvailableDate: [DomainQueryKey.Classes, "nextAvailableDate"] as const,
  },
  push: {
    status: [DomainQueryKey.PushStatus] as const,
  },
  enrollments: {
    // Inscrições do usuário logado — quem é vem da sessão, então a key não
    // leva parâmetro. O logout remove essa query.
    mine: [DomainQueryKey.MyEnrollments] as const,
  },
  users: {
    search: (search: string) => [DomainQueryKey.Users, search] as const,
  },
};
