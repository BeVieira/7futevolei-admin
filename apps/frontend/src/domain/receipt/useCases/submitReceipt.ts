import { useMutation, useQueryClient } from "@tanstack/react-query";
import { receiptService } from "../service";
import { queryKeys } from "../../queryKeys";
import { toActionError } from "../../../utils/errors";

async function submitReceipt(
  classSessionId: number,
  enrollmentId: number,
  file: File,
) {
  try {
    return await receiptService.submitReceipt(
      classSessionId,
      enrollmentId,
      file,
    );
  } catch (err) {
    throw toActionError(err, "Erro ao enviar comprovante");
  }
}

export function useSubmitReceipt(
  classSessionId: number,
  enrollmentId: number,
  studentName: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      submitReceipt(classSessionId, enrollmentId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.classes.detail(classSessionId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.enrollments.myEnrollments(studentName),
      });
    },
  });
}
