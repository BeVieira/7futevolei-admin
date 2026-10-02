import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "@domain/auth/service";
import { pushService } from "@domain/push/service";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

// Ponto único de saída do app. A ordem importa: desinscrever o push deste
// aparelho precisa da sessão ainda de pé (a rota de unsubscribe exige
// login), então vem antes do logout — e é best-effort: se falhar (sem
// permissão, offline, push não configurado), a pessoa sai mesmo assim.
async function logout() {
  await pushService.disable().catch(() => {});

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
      queryClient.setQueryData(queryKeys.auth.me, null);
      queryClient.removeQueries({ queryKey: queryKeys.enrollments.mine });
      queryClient.invalidateQueries({ queryKey: queryKeys.push.status });
    },
  });
}
