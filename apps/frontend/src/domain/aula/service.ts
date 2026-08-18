import { aulaApi } from "./api";
import { ClassLevel, ClassSessionSummary, TimeSlotInput } from "./types";

const DEFAULT_LEVELS: ClassLevel[] = ["Iniciante", "Intermediário", "Avançado"];

const MIN_COURTS = 1;
const MAX_COURTS = 3;

function getClassesByDate(date: string) {
  return aulaApi.getClassesByDate(date);
}

function getClassById(id: number) {
  return aulaApi.getClassById(id);
}

function getClassDatesByMonth(month: string) {
  return aulaApi.getClassDatesByMonth(month);
}

function createClassesForDay(
  date: string,
  timeSlots: TimeSlotInput[],
  lockAt?: string,
) {
  return aulaApi.createClassesForDay(date, timeSlots, lockAt);
}

function updateClass(
  id: number,
  changes: Partial<{
    startTime: string;
    endTime: string;
    classLevel: ClassLevel;
    capacity: number;
    lockAt: string | null;
  }>,
) {
  return aulaApi.updateClass(id, changes);
}

function deleteClass(id: number) {
  return aulaApi.deleteClass(id);
}

function buildDefaultTimeSlot(startTime = "06:00"): TimeSlotInput {
  return { startTime, levels: [...DEFAULT_LEVELS] };
}

function clampCourtsCount(count: number): number {
  return Math.min(MAX_COURTS, Math.max(MIN_COURTS, count));
}

function nextCourtLevel(currentCourtsCount: number): ClassLevel {
  return DEFAULT_LEVELS[currentCourtsCount] ?? "Iniciante";
}

function getSideCapacity(capacity: number): number {
  return Math.floor(capacity / 2);
}

function isClassFull(session: ClassSessionSummary): boolean {
  return session.confirmedCount >= session.capacity;
}

function groupClassesByTimeSlot(
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
function getNextClassDay(from: Date = new Date()): Date {
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

export const aulaService = {
  getClassesByDate,
  getClassById,
  getClassDatesByMonth,
  createClassesForDay,
  updateClass,
  deleteClass,
  buildDefaultTimeSlot,
  clampCourtsCount,
  nextCourtLevel,
  getSideCapacity,
  isClassFull,
  groupClassesByTimeSlot,
  getNextClassDay,
};
