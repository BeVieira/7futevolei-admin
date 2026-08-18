import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export async function listEnrollmentsByStudentName(req: Request, res: Response) {
  const studentName = req.query.studentName;

  if (typeof studentName !== "string" || !studentName.trim()) {
    res
      .status(400)
      .json({ error: "Query param 'studentName' is required" });
    return;
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentName: { equals: studentName.trim(), mode: "insensitive" },
    },
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
