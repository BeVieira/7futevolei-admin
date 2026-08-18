import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authService, queryKeys } from "@domain";
import { toActionError } from "@utils";

async function login(username: string, password: string) {
  try {
    return await authService.login(username, password);
  } catch (err) {
    throw toActionError(err, "Erro ao entrar");
  }
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { username: string; password: string }) =>
      login(vars.username, vars.password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });
}
