import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { userService } from "@domain/user/service";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

const MIN_SEARCH_LENGTH = 2;

async function searchUsers(search: string) {
  try {
    return await userService.searchUsers(search);
  } catch (err) {
    throw toActionError(err, "Erro ao buscar alunos");
  }
}

// Só busca a partir de 2 caracteres; enquanto a próxima busca não chega, a
// lista anterior continua na tela (sem piscar "vazio" a cada tecla).
export function useSearchUsers(search: string) {
  const trimmed = search.trim();
  return useQuery({
    queryKey: queryKeys.users.search(trimmed),
    queryFn: () => searchUsers(trimmed),
    enabled: trimmed.length >= MIN_SEARCH_LENGTH,
    placeholderData: keepPreviousData,
  });
}
