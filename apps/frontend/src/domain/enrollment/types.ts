export type Side = "LEFT" | "RIGHT";

export type EnrollmentSummary = {
  id: number;
  studentName: string;
  side: Side;
  createdAt: string;
};
