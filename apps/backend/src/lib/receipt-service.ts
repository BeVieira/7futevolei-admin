import fs from "fs/promises";
import path from "path";
import { prisma } from "./prisma";

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
