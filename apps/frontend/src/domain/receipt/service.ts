import { receiptApi } from "./api";
import { ReceiptStatus } from "./types";

function submitReceipt(
  classSessionId: number,
  enrollmentId: number,
  file: File,
) {
  return receiptApi.submitReceipt(classSessionId, enrollmentId, file);
}

function reviewReceipt(
  classSessionId: number,
  enrollmentId: number,
  status: "APPROVED" | "REJECTED",
  adminComment?: string,
) {
  return receiptApi.reviewReceipt(
    classSessionId,
    enrollmentId,
    status,
    adminComment,
  );
}

function receiptStatusLabel(status: ReceiptStatus): string {
  switch (status) {
    case "PENDING":
      return "Aguardando avaliação";
    case "APPROVED":
      return "Aprovado";
    case "REJECTED":
      return "Negado";
  }
}

function getReceiptFileUrl(filePath: string): string {
  return `/${filePath}`;
}

export const receiptService = {
  submitReceipt,
  reviewReceipt,
  receiptStatusLabel,
  getReceiptFileUrl,
};
