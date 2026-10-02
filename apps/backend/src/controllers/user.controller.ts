import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { toUserProfile } from "../lib/auth-service";
import {
  searchUsersQuerySchema,
  updateMyProfileSchema,
} from "../schemas/user.schema";

// Teto de resultados da busca: a tela do admin mostra uma lista curta pra
// escolher, e quem não aparece é só digitar mais do nome/e-mail.
const SEARCH_RESULTS_LIMIT = 20;

// Admin escolhendo um usuário cadastrado pra inscrever numa turma: busca
// por pedaço do nome ou do e-mail, sem diferenciar maiúsculas.
export async function searchUsers(req: Request, res: Response) {
  const result = searchUsersQuerySchema.safeParse(req.query);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const search = result.data.search;

  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    take: SEARCH_RESULTS_LIMIT,
    select: { id: true, name: true, email: true, photoUrl: true },
  });

  res.json(users);
}

// O próprio usuário editando o nome exibido. Como as listas fazem join com
// `User.name`, a troca aparece em todas as turmas, inclusive as passadas.
export async function updateMyProfile(req: Request, res: Response) {
  const result = updateMyProfileSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const user = await prisma.user.update({
    where: { id: res.locals.user.id },
    data: { name: result.data.name },
  });

  res.json(toUserProfile(user));
}
