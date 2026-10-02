import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pushService, queryKeys } from "@domain";
import { toActionError } from "@utils";

async function enablePush() {
  try {
    await pushService.enable();
  } catch (err) {
    throw toActionError(err, "Erro ao ativar notificações");
  }
}

export function useEnablePush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enablePush,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.push.status });
      queryClient.invalidateQueries({
        queryKey: queryKeys.push.inviteDismissed,
      });
    },
  });
}
