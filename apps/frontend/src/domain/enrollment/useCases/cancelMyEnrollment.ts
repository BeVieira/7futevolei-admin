import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollmentService } from "@domain/enrollment/service";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

async function cancelMyEnrollment(classId: number) {
  try {
    await enrollmentService.cancelMyEnrollmentInClass(classId);
  } catch (err) {
    throw toActionError(err, "Erro ao cancelar inscrição");
  }
}

// Mesmo cuidado do `useEnrollStudent`: termina só depois de "minhas aulas"
// recarregar, pra o card não mostrar a vaga cancelada por um instante.
export function useCancelMyEnrollment(classId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelMyEnrollment(classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.classes.detail(classId),
      });
      return queryClient.invalidateQueries({
        queryKey: queryKeys.enrollments.mine,
      });
    },
  });
}
