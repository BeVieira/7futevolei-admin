import { useMutation, useQueryClient } from "@tanstack/react-query";
import { receiptService, queryKeys } from "@domain";
import { toActionError } from "@utils";

async function reviewReceipt(
  classSessionId: number,
  enrollmentId: number,
  status: "APPROVED" | "REJECTED",
  adminComment?: string,
) {
  try {
    return await receiptService.reviewReceipt(
      classSessionId,
      enrollmentId,
      status,
      adminComment,
    );
  } catch (err) {
    throw toActionError(err, "Erro ao avaliar comprovante");
  }
}

export function useReviewReceipt(classSessionId: number, enrollmentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      status,
      adminComment,
    }: {
      status: "APPROVED" | "REJECTED";
      adminComment?: string;
    }) => reviewReceipt(classSessionId, enrollmentId, status, adminComment),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.classes.detail(classSessionId),
      });
    },
  });
}
