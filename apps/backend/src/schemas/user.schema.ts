import { z } from "zod";

export const updateMyProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

// Busca do admin ao escolher quem inscrever. Vazio lista os primeiros por
// ordem alfabética.
export const searchUsersQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
});
