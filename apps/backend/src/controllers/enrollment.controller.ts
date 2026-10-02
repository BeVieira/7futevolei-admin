import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

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
