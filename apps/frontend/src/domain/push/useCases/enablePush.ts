import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pushService, queryKeys } from "@domain";
import { toActionError } from "@utils";

async function enablePush(studentName?: string) {
  try {
    await pushService.enable(studentName);
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
    },
  });
}
