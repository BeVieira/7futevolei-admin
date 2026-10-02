export type UserRole = "STUDENT" | "ADMIN";

// Usuário da sessão atual, como devolvido por /auth/me.
export type Me = {
  id: number;
  name: string;
  email: string;
  photoUrl: string | null;
  role: UserRole;
};

// Começo de uma tentativa de login com Google (POST /auth/google/nonce).
// O segredo correspondente fica só no cookie httpOnly `login_nonce`.
export type GoogleLoginAttempt = {
  nonce: string;
};
