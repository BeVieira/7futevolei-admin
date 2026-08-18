import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollmentService, Side, queryKeys } from "@domain";
import { toActionError } from "@utils";

async function adminEnrollStudent(
  classId: number,
  studentName: string,
  side: Side,
) {
  try {
    await enrollmentService.enrollStudentInClass(classId, studentName, side);
  } catch (err) {
    throw toActionError(err, "Erro ao inscrever aluno");
  }
}

export function useAdminEnrollStudent(classId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { studentName: string; side: Side }) =>
      adminEnrollStudent(classId, vars.studentName, vars.side),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.classes.detail(classId),
      });
    },
  });
}
