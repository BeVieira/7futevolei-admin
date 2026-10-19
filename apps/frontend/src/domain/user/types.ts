import { Side } from "@domain/enrollment/types";

// Resultado da busca de usuários do admin (GET /users). `preferredSide`
// null = ainda não escolheu o lado no perfil, então não dá pra inscrever.
export type UserSearchResult = {
  id: number;
  name: string;
  photoUrl: string | null;
  preferredSide: Side | null;
};
