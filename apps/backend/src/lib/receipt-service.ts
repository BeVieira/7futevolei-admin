import { Prisma } from "@prisma/client";
import fs from "fs/promises";
import path from "path";
import { prisma } from "./prisma";

export class ReceiptNotFoundError extends Error {
  constructor(message = "Receipt not found") {
    super(message);
    this.name = "ReceiptNotFoundError";
  }
}

const BACKEND_ROOT = path.join(__dirname, "..", "..");

type UploadedFile = {
  filePath: string;
  mimeType: string;
};

// Um Receipt por Enrollment (relação 1–1): reenviar sobrescreve o arquivo
// anterior no disco e reseta o status para PENDING, em vez de acumular um
// histórico de N arquivos por inscrição.
export async function submitReceipt(enrollmentId: number, file: UploadedFile) {
  await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });

  const existing = await prisma.receipt.findUnique({ where: { enrollmentId } });
  if (existing) {
    await fs.unlink(path.join(BACKEND_ROOT, existing.filePath)).catch(() => {});
  }

  return prisma.receipt.upsert({
    where: { enrollmentId },
    create: { enrollmentId, filePath: file.filePath, mimeType: file.mimeType },
    update: {
      filePath: file.filePath,
      mimeType: file.mimeType,
      status: "PENDING",
      adminComment: null,
    },
  });
}

// Sem `withSerializableRetry`/`Serializable` como em enrollment-service.ts:
// aquele padrão existe para proteger a invariante de capacidade por lado,
// disputada por dois alunos ao mesmo tempo. Aqui não há invariante
// compartilhada em jogo — o pior caso de concorrência é o próprio aluno
// reenviando duas vezes seguidas, o que não corrompe nada.
export async function reviewReceipt(
  enrollmentId: number,
  status: "APPROVED" | "REJECTED",
  adminComment: string | undefined,
) {
  try {
    return await prisma.receipt.update({
      where: { enrollmentId },
      data: { status, adminComment: adminComment ?? null },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new ReceiptNotFoundError();
    }
    throw error;
  }
}
