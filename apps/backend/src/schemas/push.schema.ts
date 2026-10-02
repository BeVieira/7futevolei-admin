import { z } from "zod";

export const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  studentName: z.string().trim().min(1).max(100).optional(),
});

export const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});
