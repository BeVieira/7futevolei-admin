export type UserRole = "STUDENT" | "ADMIN";

// Usuário da sessão atual, como devolvido por /auth/me.
export type Me = {
  id: number;
  name: string;
  email: string;
  photoUrl: string | null;
  role: UserRole;
};
