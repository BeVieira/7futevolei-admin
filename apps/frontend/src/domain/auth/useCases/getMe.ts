import { useQuery } from "@tanstack/react-query";
import { authService, queryKeys } from "@domain";
import { toActionError } from "@utils";

async function getMe() {
  try {
    return await authService.getMe();
  } catch (err) {
    throw toActionError(err, "Não autenticado");
  }
}

export function useGetMe() {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: getMe,
    retry: false,
  });
}
