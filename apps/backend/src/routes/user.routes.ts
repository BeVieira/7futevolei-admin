import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAdmin, requireAuth } from "../lib/requireAuth";
import { searchUsers, updateMyProfile } from "../controllers/user.controller";

export const userRouter = Router();

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Busca usuários cadastrados por nome ou e-mail exato (admin escolhendo quem inscrever)
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Pedaço do nome ou o e-mail inteiro (sem diferenciar maiúsculas; o banco só guarda o hash do e-mail, então pedaço de e-mail não acha). Vazio lista os primeiros em ordem alfabética.
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
 *     summary: Atualiza o nome exibido e/ou o lado preferido do usuário logado
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
 *         description: Nenhum campo enviado, nome vazio/com mais de 100 caracteres ou lado inválido
 *       401:
 *         description: Não autenticado
 */
userRouter.patch("/me", requireAuth, asyncHandler(updateMyProfile));
