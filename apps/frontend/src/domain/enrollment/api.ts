import { API_BASE_URL, apiFetch, handleResponse } from "@utils";
import { AdminEnrollee, MyEnrollmentSummary, Side } from "./types";

const BASE_URL = `${API_BASE_URL}/class-sessions`;
const ENROLLMENTS_URL = `${API_BASE_URL}/enrollments`;

// Quem se inscreve é o usuário da sessão — o payload só escolhe o lado.
function enrollMeInClass(classId: number, side: Side) {
  return apiFetch(`${BASE_URL}/${classId}/enrollments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ side }),
  }).then(res => handleResponse(res));
}

function cancelMyEnrollmentInClass(classId: number) {
  return apiFetch(`${BASE_URL}/${classId}/enrollments/cancel`, {
    method: "POST",
  }).then(res => handleResponse(res));
}

function adminEnrollInClass(
  classId: number,
  enrollee: AdminEnrollee,
  side: Side,
) {
  return apiFetch(`${BASE_URL}/${classId}/enrollments/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...enrollee, side }),
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
  removeEnrollment,
  getMyEnrollments,
};
