import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollmentService } from "@domain/enrollment/service";
import { AdminEnrollee } from "@domain/enrollment/types";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

async function adminEnrollStudent(classId: number, enrollee: AdminEnrollee) {
  try {
    await enrollmentService.adminEnrollInClass(classId, enrollee);
  } catch (err) {
    throw toActionError(err, "Erro ao inscrever aluno");
  }
}

// Admin inscrevendo um usuário cadastrado ou um convidado só pelo nome.
export function useAdminEnrollStudent(classId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enrollee: AdminEnrollee) =>
      adminEnrollStudent(classId, enrollee),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.classes.detail(classId),
      });
    },
  });
}
