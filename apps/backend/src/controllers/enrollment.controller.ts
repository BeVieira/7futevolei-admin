import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { hashGuestCancelToken } from "../lib/enrollment-service";
import { guestLookupSchema } from "../schemas/class-session.schema";

// "Minhas aulas": as inscrições do usuário logado, pela sessão.
export async function listMyEnrollments(_req: Request, res: Response) {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: res.locals.user.id },
    include: { classSession: true, receipt: true },
    orderBy: { classSession: { date: "desc" } },
  });

  res.json(
    enrollments.map((e) => ({
      enrollment: {
        id: e.id,
        side: e.side,
        status: e.status,
        createdAt: e.createdAt,
      },
      classSession: {
        id: e.classSession.id,
        date: e.classSession.date,
        startTime: e.classSession.startTime,
        endTime: e.classSession.endTime,
        classLevel: e.classSession.classLevel,
      },
      receipt: e.receipt
        ? {
            id: e.receipt.id,
            status: e.receipt.status,
            adminComment: e.receipt.adminComment,
            filePath: e.receipt.filePath,
          }
        : null,
    })),
  );
}

// Inscrições que o convidado sem conta fez deste aparelho, pelos códigos que
// ele guardou. Código que não volta na resposta é de inscrição que não
// existe mais (o admin removeu, a turma foi excluída) — o front esquece.
export async function lookupGuestEnrollments(req: Request, res: Response) {
  const result = guestLookupSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const tokenByHash = new Map(
    result.data.cancelTokens.map(token => [hashGuestCancelToken(token), token]),
  );

  const enrollments = await prisma.enrollment.findMany({
    where: { guestCancelTokenHash: { in: [...tokenByHash.keys()] } },
  });

  res.json(
    enrollments.map(e => ({
      cancelToken: tokenByHash.get(e.guestCancelTokenHash ?? ""),
      classSessionId: e.classSessionId,
      enrollment: {
        id: e.id,
        studentName: e.guestName ?? "",
        side: e.side,
        status: e.status,
        createdAt: e.createdAt,
      },
    })),
  );
}
