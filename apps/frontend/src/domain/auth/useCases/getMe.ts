import { useQuery } from "@tanstack/react-query";
import { authService } from "@domain/auth/service";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

async function getMe() {
  try {
    return await authService.getMe();
  } catch (err) {
    throw toActionError(err, "Erro ao carregar sua sessão");
  }
}

// `data` é `null` quando ninguém está logado (não é erro). Na abertura do
// app, um access token vencido não vira "deslogado" direto: o `apiFetch`
// tenta renovar pelo refresh token antes, então quem tem sessão válida
// nunca vê "Entrar" piscar.
export function useGetMe() {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: getMe,
    retry: false,
    staleTime: 60 * 1000,
  });
}
