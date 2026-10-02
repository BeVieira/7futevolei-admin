import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollmentService } from "@domain/enrollment/service";
import { AdminEnrollee, Side } from "@domain/enrollment/types";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

async function adminEnrollStudent(
  classId: number,
  enrollee: AdminEnrollee,
  side: Side,
) {
  try {
    await enrollmentService.adminEnrollInClass(classId, enrollee, side);
  } catch (err) {
    throw toActionError(err, "Erro ao inscrever aluno");
  }
}

// Admin inscrevendo um usuário cadastrado ou um convidado só pelo nome.
export function useAdminEnrollStudent(classId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { enrollee: AdminEnrollee; side: Side }) =>
      adminEnrollStudent(classId, vars.enrollee, vars.side),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.classes.detail(classId),
      });
    },
  });
}
