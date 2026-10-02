import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../lib/requireAuth";
import {
  loginWithGoogle,
  logout,
  me,
  refresh,
} from "../controllers/auth.controller";

export const authRouter = Router();

// Não há senha pra adivinhar (quem valida a conta é o Google), mas cada
// chamada verifica um token e escreve no banco — o limite só evita que um
// loop martele a rota.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Tente novamente mais tarde." },
});

/**
 * @openapi
 * /api/auth/google:
 *   post:
 *     summary: Login com Google — valida o ID token e inicia a sessão via cookies httpOnly
 *     description: >
 *       Primeiro login cria a conta (aluno, ou admin se o e-mail estiver em
 *       ADMIN_EMAILS). Logins seguintes atualizam e-mail, foto e papel, mas
 *       não o nome (editável pelo usuário).
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/GoogleLoginInput"
 *     responses:
 *       200:
 *         description: Login bem-sucedido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/UserProfile"
 *       400:
 *         description: Payload inválido
 *       401:
 *         description: ID token do Google inválido, expirado, de outro app ou com e-mail não verificado
 *       503:
 *         description: Login com Google não configurado no servidor (GOOGLE_CLIENT_ID ausente)
 */
authRouter.post("/google", loginRateLimit, asyncHandler(loginWithGoogle));

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Renova a sessão a partir do refresh token (rotaciona os dois cookies)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Sessão renovada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/UserProfile"
 *       401:
 *         description: Refresh token ausente, inválido, expirado ou já usado
 */
authRouter.post("/refresh", asyncHandler(refresh));

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Termina a sessão (invalida o par de tokens e limpa os cookies)
 *     tags: [Auth]
 *     responses:
 *       204:
 *         description: Sessão terminada
 */
authRouter.post("/logout", asyncHandler(logout));

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Retorna o usuário (aluno ou admin) autenticado na sessão atual
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Usuário autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/UserProfile"
 *       401:
 *         description: Não autenticado
 */
authRouter.get("/me", requireAuth, asyncHandler(me));
