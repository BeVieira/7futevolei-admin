import { z } from "zod";

// Atualização parcial: manda só o que mudou (o nome ou o lado preferido).
// O lado, uma vez escolhido, só troca — não volta a ficar vazio.
export const updateMyProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    preferredSide: z.enum(["LEFT", "RIGHT"]).optional(),
  })
  .refine(
    data => data.name !== undefined || data.preferredSide !== undefined,
    { message: "Informe o nome ou o lado preferido" },
  );

// Busca do admin ao escolher quem inscrever. Vazio lista os primeiros por
// ordem alfabética.
export const searchUsersQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
});
