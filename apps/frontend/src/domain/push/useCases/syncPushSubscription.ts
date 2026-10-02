import { useQuery } from "@tanstack/react-query";
import { pushService, queryKeys } from "@domain";

// Reatribui a inscrição de push deste aparelho ao usuário logado, uma vez
// por usuário (a key leva o `userId`: trocar de conta reenvia). Montado
// onde a sessão é conhecida (o Layout), com `userId` indefinido enquanto
// ninguém está logado. Best-effort: falha não aparece pra ninguém, o
// aparelho só continua com o dono anterior até a próxima tentativa.
export function useSyncPushSubscription(userId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.push.sync(userId ?? 0),
    queryFn: () => pushService.syncSubscription().catch(() => false),
    enabled: userId !== undefined,
    staleTime: Infinity,
    retry: false,
  });
}
