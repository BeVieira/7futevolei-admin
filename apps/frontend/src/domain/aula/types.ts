import {
  AdminEnrollmentSummary,
  EnrollmentSummary,
} from "@domain/enrollment/types";

export const CLASS_LEVELS = ["Iniciante", "Intermediário", "Avançado"] as const;

export type ClassLevel = (typeof CLASS_LEVELS)[number];

export type ClassSessionSummary = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  classLevel: ClassLevel;
  capacity: number;
  lockAt: string | null;
  isLocked: boolean;
  confirmedCount: number;
  waitlistCount: number;
  confirmedLeft: string[];
  confirmedRight: string[];
  waitlist: string[];
};

// Detalhe da turma. Por padrão, a visão pública (só nome e lado de cada
// inscrição); `AdminClassSessionDetail` é a do admin.
export type ClassSessionDetail<E = EnrollmentSummary> = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  classLevel: ClassLevel;
  capacity: number;
  lockAt: string | null;
  isLocked: boolean;
  confirmedCount: number;
  waitlistCount: number;
  confirmed: E[];
  waitlist: E[];
};

export type AdminClassSessionDetail =
  ClassSessionDetail<AdminEnrollmentSummary>;

export type TimeSlotInput = {
  startTime: string;
  levels: ClassLevel[];
};

// Um disparo do aviso "turmas abertas" (push pra todos os aparelhos).
export type ClassOpeningNotification = {
  classDate: string; // YYYY-MM-DD — dia das turmas anunciadas
  sentAt: string;
  devicesNotified: number;
};
