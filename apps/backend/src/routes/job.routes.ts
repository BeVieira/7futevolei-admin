import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireCronSecret } from "../lib/requireCronSecret";
import { runReceiptReminders } from "../controllers/job.controller";

export const jobRouter = Router();

/**
 * @openapi
 * /api/jobs/receipt-reminders:
 *   post:
 *     summary: Envia o lembrete de comprovante das aulas que acabaram de terminar
 *     description: |
 *       Chamado por cron externo (cron-job.org, 7:30/8:30/9:30/10:30 em
 *       America/Sao_Paulo). Avisa por push cada inscrito confirmado, com
 *       conta, sem comprovante, cuja aula terminou nas últimas 24h. Idempotente:
 *       cada inscrição é lembrada no máximo uma vez (`receiptReminderSentAt`),
 *       inclusive quando o aluno não tem aparelho com push ativo.
 *     tags: [Jobs]
 *     security:
 *       - cronSecret: []
 *     responses:
 *       200:
 *         description: Execução concluída
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reminded:
 *                   type: integer
 *                   description: Inscrições marcadas como lembradas nesta execução
 *                 devicesNotified:
 *                   type: integer
 *                   description: Aparelhos que receberam o push
 *       401:
 *         description: Header Authorization ausente ou com segredo errado
 *       503:
 *         description: CRON_SECRET ou push (VAPID_*) não configurado no servidor
 */
jobRouter.post(
  "/receipt-reminders",
  requireCronSecret,
  asyncHandler(runReceiptReminders),
);
