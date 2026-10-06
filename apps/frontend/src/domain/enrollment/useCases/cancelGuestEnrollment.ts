import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollmentService } from "@domain/enrollment/service";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

async function cancelGuestEnrollment(classId: number, cancelToken: string) {
  try {
    await enrollmentService.cancelGuestEnrollmentInClass(classId, cancelToken);
  } catch (err) {
    throw toActionError(err, "Erro ao cancelar inscrição");
  }
}

// Convidado sem conta cancelando com o código guardado neste aparelho.
export function useCancelGuestEnrollment(classId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cancelToken: string) =>
      cancelGuestEnrollment(classId, cancelToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.classes.detail(classId),
      });
      return queryClient.invalidateQueries({
        queryKey: queryKeys.enrollments.guest,
      });
    },
  });
}
