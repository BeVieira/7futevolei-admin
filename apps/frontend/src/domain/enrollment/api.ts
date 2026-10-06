import { API_BASE_URL, apiFetch, handleResponse } from "@utils";
import {
  AdminEnrollee,
  GuestEnrollee,
  GuestEnrollmentSummary,
  MyEnrollmentSummary,
} from "./types";

const BASE_URL = `${API_BASE_URL}/class-sessions`;
const ENROLLMENTS_URL = `${API_BASE_URL}/enrollments`;

// Sem corpo: quem se inscreve é o usuário da sessão, no lado do perfil.
function enrollMeInClass(classId: number) {
  return apiFetch(`${BASE_URL}/${classId}/enrollments`, {
    method: "POST",
  }).then(res => handleResponse(res));
}

function cancelMyEnrollmentInClass(classId: number) {
  return apiFetch(`${BASE_URL}/${classId}/enrollments/cancel`, {
    method: "POST",
  }).then(res => handleResponse(res));
}

function adminEnrollInClass(classId: number, enrollee: AdminEnrollee) {
  return apiFetch(`${BASE_URL}/${classId}/enrollments/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(enrollee),
  }).then(res => handleResponse(res));
}

// Público: devolve, junto da inscrição, o código pra cancelar depois.
function enrollGuestInClass(
  classId: number,
  enrollee: GuestEnrollee,
): Promise<{ cancelToken: string }> {
  return apiFetch(`${BASE_URL}/${classId}/enrollments/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(enrollee),
  }).then(res => handleResponse(res));
}

function cancelGuestEnrollmentInClass(classId: number, cancelToken: string) {
  return apiFetch(`${BASE_URL}/${classId}/enrollments/guest/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cancelToken }),
  }).then(res => handleResponse(res));
}

function lookupGuestEnrollments(
  cancelTokens: string[],
): Promise<GuestEnrollmentSummary[]> {
  return apiFetch(`${ENROLLMENTS_URL}/guest/lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cancelTokens }),
  }).then(res => handleResponse(res));
}

function removeEnrollment(classId: number, enrollmentId: number) {
  return apiFetch(`${BASE_URL}/${classId}/enrollments/${enrollmentId}`, {
    method: "DELETE",
  }).then(res => handleResponse(res));
}

function getMyEnrollments(): Promise<MyEnrollmentSummary[]> {
  return apiFetch(`${ENROLLMENTS_URL}/me`).then(res => handleResponse(res));
}

export const enrollmentApi = {
  enrollMeInClass,
  cancelMyEnrollmentInClass,
  adminEnrollInClass,
  enrollGuestInClass,
  cancelGuestEnrollmentInClass,
  lookupGuestEnrollments,
  removeEnrollment,
  getMyEnrollments,
};
