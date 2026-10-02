import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@domain/queryKeys";
import { onSessionExpired } from "@utils";

// Quando a renovação da sessão falha de vez no meio do uso (refresh vencido
// ou revogado — ver `onSessionExpired` em utils/http.ts), zera o usuário em
// cache: o cabeçalho volta pra "Entrar" e `RequireAuth`/`RequireAdmin`
// mandam pro login, em vez de a tela ficar mostrando erros de 401. Montado
// uma vez, no `Layout`.
export function useClearSessionOnExpiry() {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.setQueryData(queryKeys.auth.me, null);
        queryClient.removeQueries({ queryKey: queryKeys.enrollments.mine });
      }),
    [queryClient],
  );
}
