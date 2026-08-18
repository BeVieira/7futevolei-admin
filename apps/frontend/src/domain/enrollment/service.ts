import { enrollmentApi } from "./api";
import { Side } from "./types";

const STORAGE_KEY = "7futevolei:my-enrollments";
const NAME_STORAGE_KEY = "7futevolei:my-name";

function enrollStudentInClass(
  classId: number,
  studentName: string,
  side: Side,
) {
  return enrollmentApi.enrollStudentInClass(classId, studentName, side);
}

function cancelEnrollmentByStudentName(classId: number, studentName: string) {
  return enrollmentApi.cancelEnrollmentByStudentName(classId, studentName);
}

function sideLabel(side: Side): string {
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

function getMyEnrollmentName(classId: number): string | null {
  return readStorage()[classId] ?? null;
}

function rememberMyEnrollment(classId: number, studentName: string) {
  const data = readStorage();
  data[classId] = studentName;
  writeStorage(data);
}

function forgetMyEnrollment(classId: number) {
  const data = readStorage();
  delete data[classId];
  writeStorage(data);
}

function getEnrollmentsByStudentName(studentName: string) {
  return enrollmentApi.getEnrollmentsByStudentName(studentName);
}

// Nome global do aparelho, usado em "Minhas Aulas" para achar todas as
// inscrições de um aluno — separado de `STORAGE_KEY` acima, que guarda o
// nome usado por turma individualmente inscrita (chaves e propósitos
// diferentes, mesmo parecendo redundante à primeira vista).
function getMyName(): string | null {
  return localStorage.getItem(NAME_STORAGE_KEY);
}

function rememberMyName(name: string) {
  localStorage.setItem(NAME_STORAGE_KEY, name);
}

function forgetMyName() {
  localStorage.removeItem(NAME_STORAGE_KEY);
}

export const enrollmentService = {
  enrollStudentInClass,
  cancelEnrollmentByStudentName,
  sideLabel,
  getMyEnrollmentName,
  rememberMyEnrollment,
  forgetMyEnrollment,
  getEnrollmentsByStudentName,
  getMyName,
  rememberMyName,
  forgetMyName,
};
