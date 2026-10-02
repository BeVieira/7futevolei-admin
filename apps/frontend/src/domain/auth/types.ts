export type UserRole = "STUDENT" | "ADMIN";

// Usuário da sessão atual, como devolvido por /auth/me.
export type Me = {
  id: number;
  name: string;
  email: string;
  photoUrl: string | null;
  role: UserRole;
};

// Começo de uma tentativa de login com Google (POST /auth/google/nonce):
// `nonce` vai pro Google; `secret` fica no aparelho pra um eventual resgate.
export type GoogleLoginAttempt = {
  nonce: string;
  secret: string;
};

// Resultado de tentar resgatar um login confirmado em outro navegador.
export type GoogleLoginClaim =
  | { status: "logged-in"; me: Me }
  | { status: "pending" }
  | { status: "invalid" };
