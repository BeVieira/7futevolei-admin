import { useMutation, useQueryClient } from "@tanstack/react-query";
import { aulaService, ClassLevel, queryKeys } from "@domain";
import { toActionError } from "@utils";

type ClassChanges = Partial<{
  startTime: string;
  endTime: string;
  classLevel: ClassLevel;
  capacity: number;
  lockAt: string | null;
}>;

async function updateClass(id: number, changes: ClassChanges) {
  try {
    return await aulaService.updateClass(id, changes);
  } catch (err) {
    throw toActionError(err, "Erro ao atualizar a aula");
  }
}

export function useUpdateClass(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: ClassChanges) => updateClass(id, changes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.detail(id) });
    },
  });
}
