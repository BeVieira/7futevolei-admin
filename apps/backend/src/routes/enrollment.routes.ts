import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../lib/requireAuth";
import { listMyEnrollments } from "../controllers/enrollment.controller";

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
