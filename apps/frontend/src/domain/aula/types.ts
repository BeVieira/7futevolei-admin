import type { EnrollmentSummary } from "../enrollment/types";

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
};

export type ClassSessionDetail = {
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
  confirmed: EnrollmentSummary[];
  waitlist: EnrollmentSummary[];
};

export type TimeSlotInput = {
  startTime: string;
  levels: ClassLevel[];
};
