// Resultado da busca de usuários do admin (GET /users).
export type UserSearchResult = {
  id: number;
  name: string;
  email: string;
  photoUrl: string | null;
};
