import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { listEnrollmentsByStudentName } from "../controllers/enrollment.controller";

export const enrollmentRouter = Router();

/**
 * @openapi
 * /api/enrollments:
 *   get:
 *     summary: Lista as inscrições de um aluno pelo nome, em todas as turmas
 *     tags: [Enrollments]
 *     parameters:
 *       - in: query
 *         name: studentName
 *         required: true
 *         schema:
 *           type: string
 *         example: "Maria Silva"
 *     responses:
 *       200:
 *         description: Inscrições do aluno, mais recentes primeiro
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/MyEnrollment"
 *       400:
 *         description: Parâmetro 'studentName' ausente
 */
enrollmentRouter.get("/", asyncHandler(listEnrollmentsByStudentName));
