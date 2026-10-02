import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAdmin, requireAuth } from "../lib/requireAuth";
import { uploadReceiptFile } from "../lib/upload";
import {
  adminCreateEnrollment,
  cancelMyEnrollment,
  createClassSessionsBulk,
  createEnrollment,
  deleteClassSession,
  getClassSessionAdminDetail,
  getClassSessionById,
  getNextAvailableDate,
  listClassDatesByMonth,
  listClassSessions,
  removeEnrollment,
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
 *                       waitlist:
 *                         type: array
 *                         items:
 *                           type: string
 *       400:
 *         description: Payload inválido
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Usuário logado não é admin
 */
classSessionRouter.post(
  "/bulk",
  requireAdmin,
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
 *                       waitlist:
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
 * /api/class-sessions/next-available-date:
 *   get:
 *     summary: Próxima data (hoje ou futura) com ao menos uma turma cadastrada
 *     description: >
 *       Ignora turmas de datas passadas. Se não houver nenhuma turma futura
 *       cadastrada, retorna a data de hoje.
 *     tags: [ClassSessions]
 *     responses:
 *       200:
 *         description: Data (YYYY-MM-DD) sugerida como padrão pro calendário
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 */
classSessionRouter.get(
  "/next-available-date",
  asyncHandler(getNextAvailableDate),
);

/**
 * @openapi
 * /api/class-sessions/{id}:
 *   get:
 *     summary: Detalha uma turma, com confirmados e lista de espera (só nomes e lados)
 *     description: >
 *       Visão pública — não diz quem é usuário ou convidado nem traz
 *       comprovantes. O admin usa GET /api/class-sessions/{id}/admin.
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
 *                         $ref: "#/components/schemas/PublicEnrollment"
 *                     waitlist:
 *                       type: array
 *                       items:
 *                         $ref: "#/components/schemas/PublicEnrollment"
 *       404:
 *         description: Turma não encontrada
 */
classSessionRouter.get("/:id", asyncHandler(getClassSessionById));

/**
 * @openapi
 * /api/class-sessions/{id}/admin:
 *   get:
 *     summary: Detalha uma turma na visão do admin (userId de cada inscrição e comprovantes)
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
 *                         $ref: "#/components/schemas/AdminEnrollment"
 *                     waitlist:
 *                       type: array
 *                       items:
 *                         $ref: "#/components/schemas/AdminEnrollment"
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Usuário logado não é admin
 *       404:
 *         description: Turma não encontrada
 */
classSessionRouter.get(
  "/:id/admin",
  requireAdmin,
  asyncHandler(getClassSessionAdminDetail),
);

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
 *       403:
 *         description: Usuário logado não é admin
 *       404:
 *         description: Turma não encontrada
 */
classSessionRouter.patch(
  "/:id",
  requireAdmin,
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
 *       403:
 *         description: Usuário logado não é admin
 *       404:
 *         description: Turma não encontrada
 */
classSessionRouter.delete(
  "/:id",
  requireAdmin,
  asyncHandler(deleteClassSession),
);

/**
 * @openapi
 * /api/class-sessions/{id}/enrollments:
 *   post:
 *     summary: Inscreve o usuário logado na turma (confirmado ou lista de espera)
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
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Turma não encontrada
 *       409:
 *         description: Usuário já inscrito nesta turma
 */
classSessionRouter.post(
  "/:id/enrollments",
  requireAuth,
  asyncHandler(createEnrollment),
);

/**
 * @openapi
 * /api/class-sessions/{id}/enrollments/admin:
 *   post:
 *     summary: Admin inscreve um usuário cadastrado ou um convidado (só nome) na turma
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
 *             $ref: "#/components/schemas/AdminEnrollInput"
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
 *         description: Payload inválido (precisa de exatamente um entre userId e guestName)
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Usuário logado não é admin
 *       404:
 *         description: Turma ou usuário não encontrado
 *       409:
 *         description: Usuário já inscrito nesta turma
 */
classSessionRouter.post(
  "/:id/enrollments/admin",
  requireAdmin,
  asyncHandler(adminCreateEnrollment),
);

/**
 * @openapi
 * /api/class-sessions/{id}/enrollments/cancel:
 *   post:
 *     summary: Cancela a inscrição do usuário logado na turma (promove o próximo da fila se aplicável)
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
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Turma não encontrada, ou o usuário não está inscrito nela
 *       409:
 *         description: Lista trancada — não é mais possível cancelar
 */
classSessionRouter.post(
  "/:id/enrollments/cancel",
  requireAuth,
  asyncHandler(cancelMyEnrollment),
);

/**
 * @openapi
 * /api/class-sessions/{id}/enrollments/{enrollmentId}:
 *   delete:
 *     summary: Remove um aluno da turma (admin, promove o próximo da fila se aplicável)
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
 *       200:
 *         description: Contadores atualizados após a remoção
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
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Usuário logado não é admin
 *       404:
 *         description: Turma ou inscrição não encontrada
 */
classSessionRouter.delete(
  "/:id/enrollments/:enrollmentId",
  requireAdmin,
  asyncHandler(removeEnrollment),
);

/**
 * @openapi
 * /api/class-sessions/{id}/enrollments/{enrollmentId}/receipt:
 *   post:
 *     summary: Envia (ou reenvia) o comprovante de pagamento de uma inscrição do usuário logado
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
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Inscrição não encontrada nesta turma, ou não pertence ao usuário logado
 */
classSessionRouter.post(
  "/:id/enrollments/:enrollmentId/receipt",
  requireAuth,
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
 *       403:
 *         description: Usuário logado não é admin
 *       404:
 *         description: Comprovante não encontrado
 */
classSessionRouter.patch(
  "/:id/enrollments/:enrollmentId/receipt",
  requireAdmin,
  asyncHandler(reviewReceipt),
);
