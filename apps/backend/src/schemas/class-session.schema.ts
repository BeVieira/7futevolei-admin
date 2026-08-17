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

export const enrollSchema = z.object({
  studentName: z.string().min(1),
  side: z.enum(["LEFT", "RIGHT"]),
});

export const cancelSchema = z.object({
  studentName: z.string().min(1),
});
