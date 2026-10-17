import { useMutation, useQueryClient } from "@tanstack/react-query";
import { aulaService } from "@domain/aula/service";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

async function notifyClassesOpened(date: string, force: boolean) {
  try {
    return await aulaService.notifyClassesOpened(date, force);
  } catch (err) {
    throw toActionError(err, "Erro ao enviar o aviso de turmas abertas");
  }
}

// `force` confirma um segundo aviso no mesmo dia — sem ele a API recusa.
export function useNotifyClassesOpened() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { date: string; force: boolean }) =>
      notifyClassesOpened(vars.date, vars.force),
    // Também no erro: um 409 significa que outro disparo aconteceu, e o
    // próximo clique precisa abrir a confirmação.
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.classes.openingNotificationToday,
      });
    },
  });
}
