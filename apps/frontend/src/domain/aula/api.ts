import { apiFetch, handleResponse } from "@utils";
import {
  ClassLevel,
  ClassSessionDetail,
  ClassSessionSummary,
  TimeSlotInput,
} from "./types";

const BASE_URL = "/api/class-sessions";

function getClassesByDate(date: string): Promise<ClassSessionSummary[]> {
  return apiFetch(`${BASE_URL}?date=${date}`).then((res) => handleResponse(res));
}

function getClassById(id: number): Promise<ClassSessionDetail> {
  return apiFetch(`${BASE_URL}/${id}`).then((res) => handleResponse(res));
}

function getClassDatesByMonth(month: string): Promise<string[]> {
  return apiFetch(`${BASE_URL}/dates?month=${month}`)
    .then((res) => handleResponse<{ dates: string[] }>(res))
    .then((body) => body.dates);
}

function getNextAvailableDate(): Promise<string> {
  return apiFetch(`${BASE_URL}/next-available-date`)
    .then((res) => handleResponse<{ date: string }>(res))
    .then((body) => body.date);
}

function createClassesForDay(
  date: string,
  timeSlots: TimeSlotInput[],
  lockAt?: string,
): Promise<ClassSessionSummary[]> {
  return apiFetch(`${BASE_URL}/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, timeSlots, lockAt }),
  }).then((res) => handleResponse(res));
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
): Promise<ClassSessionSummary> {
  return apiFetch(`${BASE_URL}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  }).then((res) => handleResponse(res));
}

function deleteClass(id: number): Promise<void> {
  return apiFetch(`${BASE_URL}/${id}`, { method: "DELETE" }).then((res) =>
    handleResponse(res),
  );
}

export const aulaApi = {
  getClassesByDate,
  getClassById,
  getClassDatesByMonth,
  getNextAvailableDate,
  createClassesForDay,
  updateClass,
  deleteClass,
};
