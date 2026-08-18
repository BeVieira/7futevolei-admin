import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authService, queryKeys } from "@domain";
import { toActionError } from "@utils";

async function logout() {
  try {
    await authService.logout();
  } catch (err) {
    throw toActionError(err, "Erro ao sair");
  }
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });
}
