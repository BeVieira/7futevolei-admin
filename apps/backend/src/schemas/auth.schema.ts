import { z } from "zod";

export const googleLoginSchema = z.object({
  credential: z.string().min(1),
});
