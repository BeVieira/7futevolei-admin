import { handleResponse } from "../../utils/http";
import type { ReceiptSummary } from "./types";

const BASE_URL = "/api/class-sessions";

export function submitReceipt(
  classSessionId: number,
  enrollmentId: number,
  file: File,
): Promise<ReceiptSummary> {
  const formData = new FormData();
  formData.append("file", file);

  return fetch(
    `${BASE_URL}/${classSessionId}/enrollments/${enrollmentId}/receipt`,
    { method: "POST", body: formData },
  ).then((res) => handleResponse(res));
}

export function reviewReceipt(
  classSessionId: number,
  enrollmentId: number,
  status: "APPROVED" | "REJECTED",
  adminComment?: string,
): Promise<ReceiptSummary> {
  return fetch(
    `${BASE_URL}/${classSessionId}/enrollments/${enrollmentId}/receipt`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, adminComment }),
    },
  ).then((res) => handleResponse(res));
}
