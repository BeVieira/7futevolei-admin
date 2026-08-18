export enum DomainQueryKey {
  Classes = "classes",
  ClassDetail = "class",
  MyEnrollments = "myEnrollments",
}

export const queryKeys = {
  classes: {
    all: [DomainQueryKey.Classes] as const,
    byDate: (date: string) => [DomainQueryKey.Classes, date] as const,
    detail: (id: number) => [DomainQueryKey.ClassDetail, id] as const,
    // "month" prefixado com Classes de propósito: invalidar queryKeys.classes.all
    // (ex.: após criar um dia de aulas) também invalida os pontinhos do calendário.
    byMonth: (month: string) =>
      [DomainQueryKey.Classes, "month", month] as const,
  },
  enrollments: {
    myEnrollments: (studentName: string) =>
      [DomainQueryKey.MyEnrollments, studentName] as const,
  },
};
