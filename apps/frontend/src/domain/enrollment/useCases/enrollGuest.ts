import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollmentService } from "@domain/enrollment/service";
import { GuestEnrollee } from "@domain/enrollment/types";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

async function enrollGuest(classId: number, enrollee: GuestEnrollee) {
  try {
    await enrollmentService.enrollGuestInClass(classId, enrollee);
  } catch (err) {
    throw toActionError(err, "Erro ao inscrever");
  }
}

// Inscrição sem conta, só com nome e lado. Mesmo cuidado do
// `useEnrollStudent`: termina só depois de as inscrições deste aparelho
// recarregarem, pra o card já abrir mostrando a vaga.
export function useEnrollGuest(classId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enrollee: GuestEnrollee) => enrollGuest(classId, enrollee),
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
