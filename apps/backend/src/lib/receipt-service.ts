import { Prisma } from "@prisma/client";
import { EnrollmentNotFoundError } from "./enrollment-service";
import { prisma } from "./prisma";
import { deleteReceiptObject } from "./storage";

export class ReceiptNotFoundError extends Error {
  constructor(message = "Receipt not found") {
    super(message);
    this.name = "ReceiptNotFoundError";
  }
}

type UploadedFile = {
  filePath: string;
  mimeType: string;
};

// Só o dono da inscrição envia comprovante dela — convidado (sem `userId`)
// não tem tela de comprovante. Chamado antes do upload pro Storage, pra não
// subir arquivo de quem não pode enviar. Inscrição de outra turma, de outro
// usuário ou inexistente respondem igual (404), sem revelar qual é o caso.
export async function ensureEnrollmentBelongsToUser(
  classSessionId: number,
  enrollmentId: number,
  userId: number,
) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, classSessionId, userId },
    select: { id: true },
  });

  if (!enrollment) {
    throw new EnrollmentNotFoundError();
  }
}

// Um Receipt por Enrollment (relação 1–1): reenviar sobrescreve o arquivo
// anterior no Supabase Storage e reseta o status para PENDING, em vez de
// acumular um histórico de N arquivos por inscrição.
export async function submitReceipt(enrollmentId: number, file: UploadedFile) {
  await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });

  const existing = await prisma.receipt.findUnique({ where: { enrollmentId } });
  if (existing) {
    await deleteReceiptObject(existing.filePath);
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
