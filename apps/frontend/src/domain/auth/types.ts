import { Side } from "@domain/enrollment/types";

export type UserRole = "STUDENT" | "ADMIN";

// Usuário da sessão atual, como devolvido por /auth/me.
export type Me = {
  id: number;
  name: string;
  // `null` se o backend não conseguiu decifrar o e-mail guardado.
  email: string | null;
  photoUrl: string | null;
  role: UserRole;
  // Lado em que o usuário é inscrito em toda turma (escolhido uma vez no
  // perfil); `null` = ainda não escolheu e precisa passar pelo /perfil.
  preferredSide: Side | null;
};

// Começo de uma tentativa de login com Google (POST /auth/google/nonce).
// O segredo correspondente fica só no cookie httpOnly `login_nonce`.
export type GoogleLoginAttempt = {
  nonce: string;
};
