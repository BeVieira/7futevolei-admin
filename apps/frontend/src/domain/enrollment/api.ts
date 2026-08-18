import { MyEnrollmentSummary, Side } from "./types";
import { handleResponse } from "@utils";

const BASE_URL = "/api/class-sessions";
const ENROLLMENTS_URL = "/api/enrollments";

function enrollStudentInClass(
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

function cancelEnrollmentByStudentName(classId: number, studentName: string) {
  return fetch(`${BASE_URL}/${classId}/enrollments/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentName }),
  }).then((res) => handleResponse(res));
}

function getEnrollmentsByStudentName(
  studentName: string,
): Promise<MyEnrollmentSummary[]> {
  return fetch(
    `${ENROLLMENTS_URL}?studentName=${encodeURIComponent(studentName)}`,
  ).then((res) => handleResponse(res));
}

export const enrollmentApi = {
  enrollStudentInClass,
  cancelEnrollmentByStudentName,
  getEnrollmentsByStudentName,
};
