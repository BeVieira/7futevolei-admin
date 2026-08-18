import { handleResponse } from "../../utils/http";
import type { MyEnrollmentSummary, Side } from "./types";

const BASE_URL = "/api/class-sessions";
const ENROLLMENTS_URL = "/api/enrollments";

export function enrollStudentInClass(
  classId: number,
  studentName: string,
  side: Side,
) {
  return fetch(`${BASE_URL}/${classId}/enrollments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentName, side }),
  }).then((res) => handleResponse(res));
}

export function cancelEnrollmentByStudentName(
  classId: number,
  studentName: string,
) {
  return fetch(`${BASE_URL}/${classId}/enrollments/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentName }),
  }).then((res) => handleResponse(res));
}

export function removeEnrollmentById(
  classId: number,
  enrollmentId: number,
): Promise<void> {
  return fetch(`${BASE_URL}/${classId}/enrollments/${enrollmentId}`, {
    method: "DELETE",
  }).then((res) => handleResponse(res));
}

export function getEnrollmentsByStudentName(
  studentName: string,
): Promise<MyEnrollmentSummary[]> {
  return fetch(
    `${ENROLLMENTS_URL}?studentName=${encodeURIComponent(studentName)}`,
  ).then((res) => handleResponse(res));
}
