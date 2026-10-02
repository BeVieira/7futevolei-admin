import { SessionUser } from "../lib/auth-service";

// Tipa o que `requireAuth`/`requireAdmin` (lib/requireAuth.ts) deixam em
// `res.locals`. Só é seguro ler `res.locals.user` em rotas protegidas por um
// dos dois — fora delas o valor não existe, apesar do tipo.
declare global {
  namespace Express {
    interface Locals {
      user: SessionUser;
    }
  }
}
