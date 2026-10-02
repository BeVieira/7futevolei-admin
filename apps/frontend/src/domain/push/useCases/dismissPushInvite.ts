import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pushService } from "@domain/push/service";
import { queryKeys } from "@domain/queryKeys";

// Só grava uma flag local (que já engole erro de storage) — não tem o que
// traduzir com `toActionError`.
async function dismissPushInvite() {
  pushService.dismissInvite();
}

export function useDismissPushInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dismissPushInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.push.inviteDismissed,
      });
    },
  });
}
