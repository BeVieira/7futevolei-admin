import * as api from "./api";
import type { ReceiptStatus } from "./types";

export function submitReceipt(
  classSessionId: number,
  enrollmentId: number,
  file: File,
) {
  return api.submitReceipt(classSessionId, enrollmentId, file);
}

export function receiptStatusLabel(status: ReceiptStatus): string {
  switch (status) {
    case "PENDING":
      return "Aguardando avaliação";
    case "APPROVED":
      return "Aprovado";
    case "REJECTED":
      return "Negado";
  }
}

export function getReceiptFileUrl(filePath: string): string {
  return `/${filePath}`;
}
