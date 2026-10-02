import { useQuery } from "@tanstack/react-query";
import { pushService } from "@domain/push/service";
import { queryKeys } from "@domain/queryKeys";

// Se o convite pós-inscrição já foi dispensado/ativado neste aparelho. Sob
// `queryKeys` (e não `useState` em cada convite) pra que dispensar um faça
// sumir todos os que estiverem na tela ao mesmo tempo.
export function useGetPushInviteDismissed() {
  return useQuery({
    queryKey: queryKeys.push.inviteDismissed,
    queryFn: pushService.isInviteDismissed,
    staleTime: Infinity,
  });
}
