import { useQuery } from "@tanstack/react-query";
import { pushService } from "@domain/push/service";
import { queryKeys } from "@domain/queryKeys";

// Reatribui a inscrição de push deste aparelho ao usuário logado quando ele
// não é o último dono gravado no aparelho — no caso comum a checagem é
// local, sem rede. A key leva o `userId`, então trocar de conta roda de
// novo. Montado onde a sessão é conhecida (o Layout), com `userId`
// indefinido enquanto ninguém está logado. Best-effort: falha não aparece
// pra ninguém, o aparelho só continua com o dono anterior até a próxima
// tentativa.
export function useSyncPushSubscription(userId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.push.sync(userId ?? 0),
    queryFn: () => pushService.syncSubscription(userId ?? 0).catch(() => false),
    enabled: userId !== undefined,
    staleTime: Infinity,
    retry: false,
  });
}
