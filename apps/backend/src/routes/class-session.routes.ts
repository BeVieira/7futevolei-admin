import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAdminAuth } from "../lib/requireAdminAuth";
import { uploadReceiptFile } from "../lib/upload";
import {
  cancelEnrollmentByName,
  createClassSessionsBulk,
  createEnrollment,
  deleteClassSession,
  deleteEnrollment,
  getClassSessionById,
  listClassDatesByMonth,
  listClassSessions,
  updateClassSession,
} from "../controllers/class-session.controller";
import {
  reviewReceipt,
  submitReceipt,
} from "../controllers/receipt.controller";

export const classSessionRouter = Router();

/**
 * @openapi
 * /api/class-sessions/bulk:
 *   post:
 *     summary: Gera as turmas de um dia (uma turma por nível em levels, por horário)
 *     tags: [ClassSessions]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/BulkCreateInput"
 *     responses:
 *       201:
 *         description: Turmas criadas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: "#/components/schemas/ClassSession"
 *                   - type: object
 *                     properties:
 *                       confirmedCount:
 *                         type: integer
 *                       waitlistCount:
 *                         type: integer
 *                       confirmedLeft:
 *                         type: array
 *                         items:
 *                           type: string
 *                       confirmedRight:
 *                         type: array
 *                         items:
 *                           type: string
 *       400:
 *         description: Payload inválido
 *       401:
 *         description: Não autenticado
 */
classSessionRouter.post(
  "/bulk",
  requireAdminAuth,
  asyncHandler(createClassSessionsBulk),
);

/**
 * @openapi
 * /api/class-sessions:
 *   get:
 *     summary: Lista as turmas de um dia
 *     tags: [ClassSessions]
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-08-14"
 *     responses:
 *       200:
 *         description: Turmas do dia, ordenadas por horário e nível
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: "#/components/schemas/ClassSession"
 *                   - type: object
 *                     properties:
 *                       confirmedCount:
 *                         type: integer
 *                       waitlistCount:
 *                         type: integer
 *                       confirmedLeft:
 *                         type: array
 *                         items:
 *                           type: string
 *                       confirmedRight:
 *                         type: array
 *                         items:
 *                           type: string
 *       400:
 *         description: Parâmetro 'date' ausente ou inválido
 */
classSessionRouter.get("/", asyncHandler(listClassSessions));

/**
 * @openapi
 * /api/class-sessions/dates:
 *   get:
 *     summary: Lista as datas de um mês que têm ao menos uma turma cadastrada
 *     tags: [ClassSessions]
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-08"
 *     responses:
 *       200:
 *         description: Datas (YYYY-MM-DD) com turmas cadastradas naquele mês
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dates:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Parâmetro 'month' ausente ou inválido
 */
classSessionRouter.get("/dates", asyncHandler(listClassDatesByMonth));

/**
 * @openapi
 * /api/class-sessions/{id}:
 *   get:
 *     summary: Detalha uma turma, com confirmados e lista de espera
 *     tags: [ClassSessions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalhe da turma
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: "#/components/schemas/ClassSession"
 *                 - type: object
 *                   properties:
 *                     confirmedCount:
 *                       type: integer
 *                     waitlistCount:
 *                       type: integer
 *                     confirmed:
 *                       type: array
 *                       items:
 *                         $ref: "#/components/schemas/Enrollment"
 *                     waitlist:
 *                       type: array
 *                       items:
 *                         $ref: "#/components/schemas/Enrollment"
 *       404:
 *         description: Turma não encontrada
 */
classSessionRouter.get("/:id", asyncHandler(getClassSessionById));

/**
 * @openapi
 * /api/class-sessions/{id}:
 *   patch:
 *     summary: Edita horário, quadra (classLevel) ou capacidade de uma turma
 *     tags: [ClassSessions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startTime:
 *                 type: string
 *                 pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$"
 *               endTime:
 *                 type: string
 *                 pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$"
 *               classLevel:
 *                 type: string
 *                 enum: [Iniciante, Intermediário, Avançado]
 *               capacity:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Turma atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ClassSession"
 *       400:
 *         description: Payload inválido
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Turma não encontrada
 */
classSessionRouter.patch(
  "/:id",
  requireAdminAuth,
  asyncHandler(updateClassSession),
);

/**
 * @openapi
 * /api/class-sessions/{id}:
 *   delete:
 *     summary: Remove uma turma (cascade nas inscrições)
 *     tags: [ClassSessions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Turma removida
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Turma não encontrada
 */
classSessionRouter.delete(
  "/:id",
  requireAdminAuth,
  asyncHandler(deleteClassSession),
);

/**
 * @openapi
 * /api/class-sessions/{id}/enrollments:
 *   post:
 *     summary: Inscreve um aluno na turma (confirmado ou lista de espera)
 *     tags: [ClassSessions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/EnrollInput"
 *     responses:
 *       201:
 *         description: Inscrição criada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enrollment:
 *                   $ref: "#/components/schemas/Enrollment"
 *                 confirmedCount:
 *                   type: integer
 *                 waitlistCount:
 *                   type: integer
 *                 capacity:
 *                   type: integer
 *       400:
 *         description: Payload inválido
 *       404:
 *         description: Turma não encontrada
 */
classSessionRouter.post("/:id/enrollments", asyncHandler(createEnrollment));

/**
 * @openapi
 * /api/class-sessions/{id}/enrollments/cancel:
 *   post:
 *     summary: Cancela a inscrição do aluno pelo nome (promove o próximo da fila se aplicável)
 *     tags: [ClassSessions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/CancelInput"
 *     responses:
 *       200:
 *         description: Contadores atualizados após o cancelamento
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 confirmedCount:
 *                   type: integer
 *                 waitlistCount:
 *                   type: integer
 *                 capacity:
 *                   type: integer
 *       400:
 *         description: Payload inválido
 *       404:
 *         description: Turma ou inscrição não encontrada
 */
classSessionRouter.post(
  "/:id/enrollments/cancel",
  asyncHandler(cancelEnrollmentByName),
);

/**
 * @openapi
 * /api/class-sessions/{id}/enrollments/{enrollmentId}:
 *   delete:
 *     summary: Remove uma inscrição diretamente pelo id (ação administrativa, sem match de nome)
 *     tags: [ClassSessions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Inscrição removida
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Turma ou inscrição não encontrada
 */
classSessionRouter.delete(
  "/:id/enrollments/:enrollmentId",
  requireAdminAuth,
  asyncHandler(deleteEnrollment),
);

/**
 * @openapi
 * /api/class-sessions/{id}/enrollments/{enrollmentId}/receipt:
 *   post:
 *     summary: Envia (ou reenvia) o comprovante de pagamento de uma inscrição
 *     tags: [ClassSessions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Comprovante salvo (status volta pra PENDING em caso de reenvio)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Receipt"
 *       400:
 *         description: Arquivo ausente, tipo inválido ou maior que 5MB
 *       404:
 *         description: Inscrição não encontrada
 */
classSessionRouter.post(
  "/:id/enrollments/:enrollmentId/receipt",
  uploadReceiptFile,
  asyncHandler(submitReceipt),
);

/**
 * @openapi
 * /api/class-sessions/{id}/enrollments/{enrollmentId}/receipt:
 *   patch:
 *     summary: Aprova ou nega o comprovante de pagamento de uma inscrição
 *     tags: [ClassSessions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/ReviewReceiptInput"
 *     responses:
 *       200:
 *         description: Comprovante atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Receipt"
 *       400:
 *         description: Payload inválido (adminComment é obrigatório ao negar)
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Comprovante não encontrado
 */
classSessionRouter.patch(
  "/:id/enrollments/:enrollmentId/receipt",
  requireAdminAuth,
  asyncHandler(reviewReceipt),
);
