import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "@domain/auth/service";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

async function claimGoogleLogin() {
  try {
    return await authService.claimPendingGoogleLogin();
  } catch (err) {
    throw toActionError(err, "Erro ao concluir o login");
  }
}

// Resgata um login que o Google devolveu em outro navegador (ver
// "Login com Google" no ARCHITECTURE.md). `data` é o `Me` se deu certo, ou
// `null` se ainda não há login confirmado pra este aparelho.
export function useClaimGoogleLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: claimGoogleLogin,
    onSuccess: me => {
      if (me) queryClient.setQueryData(queryKeys.auth.me, me);
    },
  });
}
