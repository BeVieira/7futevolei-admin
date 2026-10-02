import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAdmin, requireAuth } from "../lib/requireAuth";
import { searchUsers, updateMyProfile } from "../controllers/user.controller";

export const userRouter = Router();

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Busca usuários cadastrados por nome ou e-mail (admin escolhendo quem inscrever)
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Pedaço do nome ou do e-mail (sem diferenciar maiúsculas). Vazio lista os primeiros em ordem alfabética.
 *     responses:
 *       200:
 *         description: Até 20 usuários, em ordem alfabética
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/UserSearchResult"
 *       400:
 *         description: Parâmetro inválido
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Usuário logado não é admin
 */
userRouter.get("/", requireAdmin, asyncHandler(searchUsers));

/**
 * @openapi
 * /api/users/me:
 *   patch:
 *     summary: Atualiza o nome exibido do usuário logado
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/UpdateMyProfileInput"
 *     responses:
 *       200:
 *         description: Perfil atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/UserProfile"
 *       400:
 *         description: Nome vazio ou com mais de 100 caracteres
 *       401:
 *         description: Não autenticado
 */
userRouter.patch("/me", requireAuth, asyncHandler(updateMyProfile));
