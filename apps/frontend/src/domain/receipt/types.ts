export type ReceiptStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ReceiptSummary = {
  id: number;
  filePath: string;
  status: ReceiptStatus;
  adminComment: string | null;
};
