import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pushService } from "@domain/push/service";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

async function disablePush() {
  try {
    await pushService.disable();
  } catch (err) {
    throw toActionError(err, "Erro ao desativar notificações");
  }
}

export function useDisablePush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disablePush,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.push.status });
    },
  });
}
