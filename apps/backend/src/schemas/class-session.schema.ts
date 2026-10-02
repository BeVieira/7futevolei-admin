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

// Aluno se inscrevendo: quem é vem da sessão, o payload só escolhe o lado.
export const enrollSchema = z.object({
  side: sideSchema,
});

// Admin inscrevendo: um usuário cadastrado (`userId`) ou um convidado só
// pelo nome (`guestName`) — exatamente um dos dois. `.strict()` faz o
// payload com os dois campos falhar nos dois ramos (sem ele, o primeiro
// ramo aceitaria e descartaria o `guestName` em silêncio).
export const adminEnrollSchema = z.union([
  z
    .object({
      side: sideSchema,
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
