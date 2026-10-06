import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../lib/requireAuth";
import {
  listMyEnrollments,
  lookupGuestEnrollments,
} from "../controllers/enrollment.controller";

export const enrollmentRouter = Router();

/**
 * @openapi
 * /api/enrollments/me:
 *   get:
 *     summary: Lista as inscrições do usuário logado, em todas as turmas
 *     tags: [Enrollments]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Inscrições do usuário, mais recentes primeiro
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/MyEnrollment"
 *       401:
 *         description: Não autenticado
 */
enrollmentRouter.get("/me", requireAuth, asyncHandler(listMyEnrollments));

/**
 * @openapi
 * /api/enrollments/guest/lookup:
 *   post:
 *     summary: Inscrições de convidado sem conta, pelos códigos de cancelamento guardados no aparelho
 *     description: Público. Códigos de inscrições que não existem mais simplesmente não voltam na resposta.
 *     tags: [Enrollments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cancelTokens]
 *             properties:
 *               cancelTokens:
 *                 type: array
 *                 maxItems: 100
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Inscrições encontradas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/GuestEnrollment"
 *       400:
 *         description: Payload inválido
 */
enrollmentRouter.post("/guest/lookup", asyncHandler(lookupGuestEnrollments));
