import { enrollmentApi } from "./api";
import {
  AdminEnrollee,
  AdminEnrollmentSummary,
  MyEnrollmentSummary,
  Side,
} from "./types";

function enrollMeInClass(classId: number, side: Side) {
  return enrollmentApi.enrollMeInClass(classId, side);
}

function cancelMyEnrollmentInClass(classId: number) {
  return enrollmentApi.cancelMyEnrollmentInClass(classId);
}

function adminEnrollInClass(
  classId: number,
  enrollee: AdminEnrollee,
  side: Side,
) {
  return enrollmentApi.adminEnrollInClass(classId, enrollee, side);
}

function removeEnrollment(classId: number, enrollmentId: number) {
  return enrollmentApi.removeEnrollment(classId, enrollmentId);
}

function getMyEnrollments() {
  return enrollmentApi.getMyEnrollments();
}

function sideLabel(side: Side): string {
  return side === "LEFT" ? "Esquerda" : "Direita";
}

// A inscrição do usuário logado numa turma, a partir de "minhas aulas" —
// é assim que a tela pública sabe se mostra "Quero participar" ou
// "Cancelar minha vaga" (a lista pública só tem nomes).
function findMyEnrollmentInClass(
  myEnrollments: MyEnrollmentSummary[],
  classId: number,
): MyEnrollmentSummary | null {
  return myEnrollments.find(e => e.classSession.id === classId) ?? null;
}

function isGuest(enrollment: AdminEnrollmentSummary): boolean {
  return enrollment.userId === null;
}

export const enrollmentService = {
  enrollMeInClass,
  cancelMyEnrollmentInClass,
  adminEnrollInClass,
  removeEnrollment,
  getMyEnrollments,
  sideLabel,
  findMyEnrollmentInClass,
  isGuest,
};
