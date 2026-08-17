import { handleResponse } from "../../utils/http";
import type {
  ClassLevel,
  ClassSessionDetail,
  ClassSessionSummary,
  TimeSlotInput,
} from "./types";

const BASE_URL = "/api/class-sessions";

export function getClassesByDate(date: string): Promise<ClassSessionSummary[]> {
  return fetch(`${BASE_URL}?date=${date}`).then((res) => handleResponse(res));
}

export function getClassById(id: number): Promise<ClassSessionDetail> {
  return fetch(`${BASE_URL}/${id}`).then((res) => handleResponse(res));
}

export function getClassDatesByMonth(month: string): Promise<string[]> {
  return fetch(`${BASE_URL}/dates?month=${month}`)
    .then((res) => handleResponse<{ dates: string[] }>(res))
    .then((body) => body.dates);
}

export function createClassesForDay(
  date: string,
  timeSlots: TimeSlotInput[],
  lockAt?: string,
): Promise<ClassSessionSummary[]> {
  return fetch(`${BASE_URL}/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, timeSlots, lockAt }),
  }).then((res) => handleResponse(res));
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
): Promise<ClassSessionSummary> {
  return fetch(`${BASE_URL}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  }).then((res) => handleResponse(res));
}

export function deleteClass(id: number): Promise<void> {
  return fetch(`${BASE_URL}/${id}`, { method: "DELETE" }).then((res) =>
    handleResponse(res),
  );
}
