import * as api from "./api";
import type { ClassLevel, ClassSessionSummary, TimeSlotInput } from "./types";

export const DEFAULT_LEVELS: ClassLevel[] = [
  "Iniciante",
  "Intermediário",
  "Avançado",
];

export const MIN_COURTS = 1;
export const MAX_COURTS = 3;

export function getClassesByDate(date: string) {
  return api.getClassesByDate(date);
}

export function getClassById(id: number) {
  return api.getClassById(id);
}

export function getClassDatesByMonth(month: string) {
  return api.getClassDatesByMonth(month);
}

export function createClassesForDay(
  date: string,
  timeSlots: TimeSlotInput[],
  lockAt?: string,
) {
  return api.createClassesForDay(date, timeSlots, lockAt);
}

export function updateClass(
  id: number,
  changes: Partial<{
    startTime: string;
    endTime: string;
    classLevel: ClassLevel;
    capacity: number;
    lockAt: string | null;
  }>,
) {
  return api.updateClass(id, changes);
}

export function deleteClass(id: number) {
  return api.deleteClass(id);
}

export function buildDefaultTimeSlot(startTime = "06:00"): TimeSlotInput {
  return { startTime, levels: [...DEFAULT_LEVELS] };
}

export function clampCourtsCount(count: number): number {
  return Math.min(MAX_COURTS, Math.max(MIN_COURTS, count));
}

export function nextCourtLevel(currentCourtsCount: number): ClassLevel {
  return DEFAULT_LEVELS[currentCourtsCount] ?? "Iniciante";
}

export function getSideCapacity(capacity: number): number {
  return Math.floor(capacity / 2);
}

export function isClassFull(session: ClassSessionSummary): boolean {
  return session.confirmedCount >= session.capacity;
}

export function groupClassesByTimeSlot(
  sessions: ClassSessionSummary[],
): [string, ClassSessionSummary[]][] {
  const byTime = new Map<string, ClassSessionSummary[]>();
  for (const session of sessions) {
    const key = `${session.startTime}-${session.endTime}`;
    if (!byTime.has(key)) byTime.set(key, []);
    byTime.get(key)!.push(session);
  }
  return Array.from(byTime.entries()).sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Retorna a próxima sexta ou sábado (o que vier primeiro), contando hoje.
 */
export function getNextClassDay(from: Date = new Date()): Date {
  const date = new Date(from);
  date.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const day = date.getDay();
    if (day === 5 || day === 6) {
      return date;
    }
    date.setDate(date.getDate() + 1);
  }

  return date;
}

export function addOneHour(startTime: string): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const totalMinutes = (hours * 60 + minutes + 60) % (24 * 60);
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}
