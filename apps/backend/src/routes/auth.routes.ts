import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../lib/requireAuth";
import {
  loginWithGoogle,
  loginWithGoogleRedirect,
  logout,
  me,
  refresh,
} from "../controllers/auth.controller";

export const authRouter = Router();

// Não há senha pra adivinhar (quem valida a conta é o Google), mas cada
// chamada verifica um token e escreve no banco — o limite só evita que um
// loop martele a rota. Folgado de propósito: o limite é por IP, e a turma
// inteira pode logar pelo mesmo Wi-Fi da arena (um IP só pra todo mundo).
// Depende do `trust proxy` certo em src/index.ts — sem ele o "IP" seria o
// do proxy e o limite viraria global.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
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
 *       409:
 *         description: O e-mail da conta Google já está vinculado a outra conta Google cadastrada
 *       503:
 *         description: Login com Google não configurado no servidor (GOOGLE_CLIENT_ID ausente)
 */
authRouter.post("/google", loginRateLimit, asyncHandler(loginWithGoogle));

/**
 * @openapi
 * /api/auth/google/callback:
 *   post:
 *     summary: Callback do login com Google no fluxo de redirect (login_uri do Google Identity Services)
 *     description: >
 *       Chamado pelo navegador num POST de formulário vindo do Google, não
 *       pelo front via fetch. Confere o double-submit `g_csrf_token` (cookie
 *       igual ao campo), valida o ID token e inicia a sessão como
 *       /api/auth/google. Sempre responde com redirect 303 pra
 *       `/login?status=ok` ou `/login?erro=<credencial|csrf|configuracao|email-em-uso>`.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               credential:
 *                 type: string
 *               g_csrf_token:
 *                 type: string
 *             required: [credential, g_csrf_token]
 *     responses:
 *       303:
 *         description: Redirect de volta pro front (/login), com o resultado na query string
 */
// O parser de formulário entra só aqui: é a única rota que recebe
// form-urlencoded (o resto da API é JSON).
authRouter.post(
  "/google/callback",
  loginRateLimit,
  express.urlencoded({ extended: false }),
  asyncHandler(loginWithGoogleRedirect),
);

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
 *     summary: Termina a sessão deste aparelho/navegador (apaga só esta sessão e limpa os cookies)
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
