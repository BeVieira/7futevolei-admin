import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAdminAuth } from "../lib/requireAdminAuth";
import { login, logout, me, refresh } from "../controllers/auth.controller";

export const authRouter = Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login administrativo — inicia a sessão via cookie httpOnly
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/LoginInput"
 *     responses:
 *       200:
 *         description: Login bem-sucedido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 username:
 *                   type: string
 *       400:
 *         description: Payload inválido
 *       401:
 *         description: Usuário ou senha incorretos
 */
authRouter.post("/login", asyncHandler(login));

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
 *               type: object
 *               properties:
 *                 username:
 *                   type: string
 *       401:
 *         description: Refresh token ausente, inválido, expirado ou já usado
 */
authRouter.post("/refresh", asyncHandler(refresh));

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Termina a sessão administrativa (limpa o cookie)
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
 *     summary: Retorna o admin autenticado na sessão atual
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Admin autenticado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 username:
 *                   type: string
 *       401:
 *         description: Não autenticado
 */
authRouter.get("/me", requireAdminAuth, me);
