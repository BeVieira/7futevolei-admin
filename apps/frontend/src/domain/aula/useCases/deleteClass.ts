import { useMutation, useQueryClient } from "@tanstack/react-query";
import { aulaService, queryKeys } from "@domain";
import { toActionError } from "@utils";

async function deleteClass(id: number) {
  try {
    await aulaService.deleteClass(id);
  } catch (err) {
    throw toActionError(err, "Erro ao remover a aula");
  }
}

export function useDeleteClass(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteClass(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
    },
  });
}
