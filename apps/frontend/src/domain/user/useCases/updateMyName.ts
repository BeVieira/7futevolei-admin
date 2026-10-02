import { useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "@domain/user/service";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

async function updateMyName(name: string) {
  try {
    return await userService.updateMyName(name.trim());
  } catch (err) {
    throw toActionError(err, "Erro ao salvar o nome");
  }
}

export function useUpdateMyName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMyName,
    onSuccess: me => {
      queryClient.setQueryData(queryKeys.auth.me, me);
      // As listas mostram o nome atual do usuário (join no backend), então
      // tudo que exibe inscritos precisa recarregar.
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.allDetails });
    },
  });
}
