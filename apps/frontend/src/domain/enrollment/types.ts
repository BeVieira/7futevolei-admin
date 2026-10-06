import { ReceiptSummary } from "@domain/receipt/types";

export type Side = "LEFT" | "RIGHT";
export type EnrollmentStatus = "CONFIRMED" | "WAITLISTED";

// Inscrição no detalhe público da turma: só nome exibido e lado.
export type EnrollmentSummary = {
  id: number;
  studentName: string;
  side: Side;
  createdAt: string;
};

// Inscrição na visão do admin: `userId` null = convidado inscrito só pelo
// nome (não tem conta, nem tela de comprovante).
export type AdminEnrollmentSummary = EnrollmentSummary & {
  userId: number | null;
  receipt: ReceiptSummary | null;
};

// Quem o admin está inscrevendo: um usuário cadastrado (entra no lado do
// perfil dele) ou um convidado, com o lado escolhido na hora.
export type AdminEnrollee =
  { userId: number } | { guestName: string; side: Side };

export type MyEnrollmentSummary = {
  enrollment: {
    id: number;
    side: Side;
    status: EnrollmentStatus;
    createdAt: string;
  };
  classSession: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    classLevel: string;
  };
  receipt: ReceiptSummary | null;
};
