import * as api from "./api";
import type { Side } from "./types";

const STORAGE_KEY = "7futevolei:my-enrollments";

export function enrollStudentInClass(
  classId: number,
  studentName: string,
  side: Side,
) {
  return api.enrollStudentInClass(classId, studentName, side);
}

export function cancelEnrollmentByStudentName(
  classId: number,
  studentName: string,
) {
  return api.cancelEnrollmentByStudentName(classId, studentName);
}

export function removeEnrollmentById(classId: number, enrollmentId: number) {
  return api.removeEnrollmentById(classId, enrollmentId);
}

export function sideLabel(side: Side): string {
  return side === "LEFT" ? "Esquerda" : "Direita";
}

type StoredEnrollments = Record<string, string>;

function readStorage(): StoredEnrollments {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStorage(data: StoredEnrollments) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getMyEnrollmentName(classId: number): string | null {
  return readStorage()[classId] ?? null;
}

export function rememberMyEnrollment(classId: number, studentName: string) {
  const data = readStorage();
  data[classId] = studentName;
  writeStorage(data);
}

export function forgetMyEnrollment(classId: number) {
  const data = readStorage();
  delete data[classId];
  writeStorage(data);
}
