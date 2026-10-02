import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../lib/requireAuth";
import {
  createGoogleLoginNonce,
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

// Pedir nonce: a tela de login pede um ao abrir e outro a cada 8 min, então
// o limite é mais largo que o do login em si.
const loginNonceRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Tente novamente mais tarde." },
});

/**
 * @openapi
 * /api/auth/google/nonce:
 *   post:
 *     summary: Começa uma tentativa de login com Google (fluxo de redirect)
 *     description: >
 *       Grava o segredo da tentativa no cookie httpOnly `login_nonce`
 *       (SameSite=None; Secure; 10 min) e devolve só o `nonce` (hash do
 *       segredo), que o front passa pro Google.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Tentativa criada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 nonce:
 *                   type: string
 *               required: [nonce]
 */
authRouter.post(
  "/google/nonce",
  loginNonceRateLimit,
  asyncHandler(createGoogleLoginNonce),
);

/**
 * @openapi
 * /api/auth/google/callback:
 *   post:
 *     summary: Login com Google — callback do fluxo de redirect (login_uri do Google Identity Services)
 *     description: >
 *       Única porta de login. Chamado pelo navegador num POST de formulário
 *       vindo do Google, não pelo front via fetch. Valida o ID token e exige
 *       que o `nonce` dele bata com o segredo do cookie `login_nonce` deste
 *       navegador e seja uma tentativa pendente (uso único). Primeiro login
 *       cria a conta (aluno, ou admin se o e-mail estiver em ADMIN_EMAILS);
 *       os seguintes atualizam e-mail, foto e papel, mas não o nome. Sempre
 *       responde com redirect 303 pra `/login?status=ok` ou
 *       `/login?erro=<credencial|tentativa-expirada|configuracao|email-em-uso>`.
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
 *             required: [credential]
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
