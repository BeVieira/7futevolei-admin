import * as api from "./api";
import type { Side } from "./types";

const STORAGE_KEY = "7futevolei:my-enrollments";
const NAME_STORAGE_KEY = "7futevolei:my-name";

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

export function getEnrollmentsByStudentName(studentName: string) {
  return api.getEnrollmentsByStudentName(studentName);
}

// Nome global do aparelho, usado em "Minhas Aulas" para achar todas as
// inscrições de um aluno — separado de `STORAGE_KEY` acima, que guarda o
// nome usado por turma individualmente inscrita (chaves e propósitos
// diferentes, mesmo parecendo redundante à primeira vista).
export function getMyName(): string | null {
  return localStorage.getItem(NAME_STORAGE_KEY);
}

export function rememberMyName(name: string) {
  localStorage.setItem(NAME_STORAGE_KEY, name);
}

export function forgetMyName() {
  localStorage.removeItem(NAME_STORAGE_KEY);
}
