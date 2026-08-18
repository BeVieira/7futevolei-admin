import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollmentService } from "../service";
import { queryKeys } from "../../queryKeys";
import { toActionError } from "../../../utils/errors";

async function cancelMyEnrollment(classId: number, studentName: string) {
  try {
    await enrollmentService.cancelEnrollmentByStudentName(classId, studentName);
    enrollmentService.forgetMyEnrollment(classId);
  } catch (err) {
    throw toActionError(err, "Erro ao cancelar inscrição");
  }
}

export function useCancelMyEnrollment(classId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (studentName: string) =>
      cancelMyEnrollment(classId, studentName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
    },
  });
}
