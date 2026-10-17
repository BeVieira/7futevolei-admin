import { z } from "zod";
import { CLASS_LEVELS } from "../lib/class-levels";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const timeSlotSchema = z.object({
  startTime: z.string().regex(timeRegex, "Expected HH:MM format"),
  levels: z.array(z.enum(CLASS_LEVELS)).min(1),
});

export const bulkCreateSchema = z.object({
  date: z.coerce.date(),
  timeSlots: z.array(timeSlotSchema).min(1),
  lockAt: z.string().regex(timeRegex, "Expected HH:MM format").optional(),
});

export const updateClassSessionSchema = z
  .object({
    startTime: z.string().regex(timeRegex, "Expected HH:MM format").optional(),
    endTime: z.string().regex(timeRegex, "Expected HH:MM format").optional(),
    classLevel: z.enum(CLASS_LEVELS).optional(),
    capacity: z.number().int().positive().optional(),
    lockAt: z
      .union([z.string().regex(timeRegex, "Expected HH:MM format"), z.null()])
      .optional(),
  })
  .refine(
    (data) => !data.startTime || !data.endTime || data.startTime < data.endTime,
    {
      message: "startTime must be before endTime",
      path: ["endTime"],
    },
  );

const sideSchema = z.enum(["LEFT", "RIGHT"]);

// Aluno se inscrevendo não manda corpo: quem é vem da sessão e o lado vem
// do perfil (`User.preferredSide`).

// Admin inscrevendo: um usuário cadastrado (`userId`, entra no lado do
// perfil dele) ou um convidado só pelo nome (`guestName`, com o lado
// escolhido na hora) — exatamente um dos dois. `.strict()` faz o
// payload com os dois campos falhar nos dois ramos (sem ele, o primeiro
// ramo aceitaria e descartaria o `guestName` em silêncio).
export const adminEnrollSchema = z.union([
  z
    .object({
      userId: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      side: sideSchema,
      guestName: z.string().trim().min(1).max(100),
    })
    .strict(),
]);

// Convidado se inscrevendo sozinho, sem conta: nome digitado e o lado.
export const guestEnrollSchema = z
  .object({
    side: sideSchema,
    guestName: z.string().trim().min(1).max(100),
  })
  .strict();

// Código de cancelamento devolvido na inscrição do convidado.
const guestCancelTokenSchema = z.string().min(1).max(100);

export const guestCancelSchema = z.object({
  cancelToken: guestCancelTokenSchema,
});

// O aparelho pergunta pelas inscrições cujos códigos guardou; o limite só
// segura um payload absurdo (o front guarda bem menos que isso).
export const guestLookupSchema = z.object({
  cancelTokens: z.array(guestCancelTokenSchema).max(100),
});

// Admin disparando o aviso "turmas abertas" do dia `date`. `force` confirma
// um segundo disparo no mesmo dia (sem ele, a API recusa com 409).
export const notifyClassesOpenedSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD format"),
  force: z.boolean().default(false),
});
