import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { toUserProfile } from "../lib/auth-service";
import { hashEmail } from "../lib/email-crypto";
import {
  searchUsersQuerySchema,
  updateMyProfileSchema,
} from "../schemas/user.schema";

type UserSearchRow = {
  id: number;
  name: string;
  photoUrl: string | null;
  preferredSide: "LEFT" | "RIGHT" | null;
};

// `%` e `_` são curingas no LIKE do Postgres. Escapados aqui (com `!` como
// caractere de escape — evita a ambiguidade de barra invertida entre JS,
// template do Prisma e SQL), o que o admin digita é sempre buscado
// literalmente ("joao_silva" não casa "joaoXsilva").
function escapeLikePattern(value: string): string {
  return value.replace(/[!%_]/g, char => `!${char}`);
}

// Admin escolhendo um usuário cadastrado pra inscrever numa turma: busca
// por pedaço do nome, sem diferenciar maiúsculas, ou pelo e-mail **inteiro**
// — o banco só tem o hash do e-mail (ver email-crypto.ts), então não dá pra
// buscar pedaço dele. Até 20 resultados (`LIMIT` literal): a tela mostra
// uma lista curta pra escolher, e quem não aparece é só digitar mais do
// nome. SQL cru (em
// vez do `contains` do Prisma) pra controlar o escape dos curingas do LIKE
// explicitamente, sem depender de como o Prisma trata `%`/`_` no termo.
export async function searchUsers(req: Request, res: Response) {
  const result = searchUsersQuerySchema.safeParse(req.query);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const search = result.data.search;
  const pattern = search ? `%${escapeLikePattern(search)}%` : null;
  const emailHash = search?.includes("@") ? hashEmail(search) : null;

  const users = await prisma.$queryRaw<UserSearchRow[]>`
    SELECT "id", "name", "photoUrl", "preferredSide"
    FROM "User"
    WHERE ${pattern}::text IS NULL
       OR "name" ILIKE ${pattern} ESCAPE '!'
       OR "emailHash" = ${emailHash}
    ORDER BY "name" ASC
    LIMIT 20
  `;

  res.json(users);
}

// O próprio usuário editando o perfil: nome exibido e/ou lado preferido
// (o lado em que ele é inscrito em toda turma).
// Como as listas fazem join com `User.name`, a troca de nome aparece em
// todas as turmas, inclusive as passadas.
export async function updateMyProfile(req: Request, res: Response) {
  const result = updateMyProfileSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const user = await prisma.user.update({
    where: { id: res.locals.user.id },
    data: {
      name: result.data.name,
      preferredSide: result.data.preferredSide,
    },
  });

  res.json(toUserProfile(user));
}
