import { z } from "zod";

export const reviewReceiptSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    adminComment: z.string().min(1).optional(),
  })
  .refine((data) => data.status !== "REJECTED" || !!data.adminComment, {
    message: "adminComment is required when rejecting",
    path: ["adminComment"],
  });
