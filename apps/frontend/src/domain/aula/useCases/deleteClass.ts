import { useMutation, useQueryClient } from "@tanstack/react-query";
import { aulaService } from "../service";
import { queryKeys } from "../../queryKeys";
import { toActionError } from "../../../utils/errors";

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
