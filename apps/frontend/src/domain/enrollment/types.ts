import { ReceiptSummary } from "@domain";

export type Side = "LEFT" | "RIGHT";
export type EnrollmentStatus = "CONFIRMED" | "WAITLISTED";

export type EnrollmentSummary = {
  id: number;
  studentName: string;
  side: Side;
  createdAt: string;
  receipt: ReceiptSummary | null;
};

export type MyEnrollmentSummary = {
  enrollment: {
    id: number;
    side: Side;
    status: EnrollmentStatus;
    createdAt: string;
  };
  classSession: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    classLevel: string;
  };
  receipt: ReceiptSummary | null;
};
