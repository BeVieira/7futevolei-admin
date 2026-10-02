import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../lib/requireAuth";
import {
  getPublicKey,
  subscribe,
  unsubscribe,
} from "../controllers/push.controller";

export const pushRouter = Router();

// Mesmo exigindo login, qualquer conta Google entra — sem limite, um loop
// encheria a tabela de endpoints falsos.
const subscribeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente mais tarde." },
});

/**
 * @openapi
 * /api/push/public-key:
 *   get:
 *     summary: Chave pública VAPID usada pelo navegador para se inscrever no push
 *     tags: [Push]
 *     responses:
 *       200:
 *         description: Chave pública
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 publicKey:
 *                   type: string
 *       503:
 *         description: Push não configurado no servidor (VAPID_* ausentes)
 */
pushRouter.get("/public-key", getPublicKey);

/**
 * @openapi
 * /api/push/subscribe:
 *   post:
 *     summary: Registra (ou atualiza) a inscrição de push deste aparelho para o usuário logado
 *     tags: [Push]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subscription]
 *             properties:
 *               subscription:
 *                 type: object
 *                 description: Resultado de PushSubscription.toJSON() no navegador
 *                 properties:
 *                   endpoint:
 *                     type: string
 *                   keys:
 *                     type: object
 *                     properties:
 *                       p256dh:
 *                         type: string
 *                       auth:
 *                         type: string
 *     responses:
 *       204:
 *         description: Inscrição salva
 *       400:
 *         description: Payload inválido
 *       401:
 *         description: Não autenticado
 */
pushRouter.post(
  "/subscribe",
  requireAuth,
  subscribeRateLimit,
  asyncHandler(subscribe),
);

/**
 * @openapi
 * /api/push/unsubscribe:
 *   post:
 *     summary: Remove a inscrição de push deste aparelho
 *     tags: [Push]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [endpoint]
 *             properties:
 *               endpoint:
 *                 type: string
 *     responses:
 *       204:
 *         description: Inscrição removida (ou já não existia)
 */
pushRouter.post("/unsubscribe", asyncHandler(unsubscribe));
