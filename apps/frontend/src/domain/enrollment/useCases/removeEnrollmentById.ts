import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollmentService, queryKeys } from "@domain";
import { toActionError } from "@utils";

async function removeEnrollmentById(classId: number, enrollmentId: number) {
  try {
    await enrollmentService.removeEnrollmentById(classId, enrollmentId);
  } catch (err) {
    throw toActionError(err, "Erro ao remover inscrição");
  }
}

export function useRemoveEnrollmentById(classId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enrollmentId: number) =>
      removeEnrollmentById(classId, enrollmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.classes.detail(classId),
      });
    },
  });
}
