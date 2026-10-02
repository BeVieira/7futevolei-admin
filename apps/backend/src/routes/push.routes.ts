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
// encheria a tabela de endpoints falsos. O mesmo limite vale pro
// unsubscribe, que é público (ver abaixo).
const pushRateLimit = rateLimit({
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
  pushRateLimit,
  asyncHandler(subscribe),
);

/**
 * @openapi
 * /api/push/unsubscribe:
 *   post:
 *     summary: Remove a inscrição de push deste aparelho
 *     description: |
 *       Público de propósito: o `endpoint` é uma URL secreta e única do
 *       aparelho (só quem tem a inscrição no navegador conhece), então ele
 *       mesmo prova a posse. Assim o aparelho consegue parar de receber
 *       notificações da conta anterior mesmo com a sessão já expirada ou
 *       derrubada (ex: logout depois de 90 dias sem abrir o app).
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
 *       400:
 *         description: Payload inválido
 */
pushRouter.post("/unsubscribe", pushRateLimit, asyncHandler(unsubscribe));
