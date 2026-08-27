import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollmentService, queryKeys } from "@domain";
import { toActionError } from "@utils";

async function removeEnrollment(classId: number, enrollmentId: number) {
  try {
    await enrollmentService.removeEnrollment(classId, enrollmentId);
  } catch (err) {
    throw toActionError(err, "Erro ao remover aluno");
  }
}

export function useRemoveEnrollment(classId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enrollmentId: number) =>
      removeEnrollment(classId, enrollmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.classes.detail(classId),
      });
    },
  });
}
