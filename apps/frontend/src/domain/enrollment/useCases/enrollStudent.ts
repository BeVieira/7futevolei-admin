import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollmentService } from "@domain/enrollment/service";
import { Side } from "@domain/enrollment/types";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

async function enrollStudent(classId: number, side: Side) {
  try {
    await enrollmentService.enrollMeInClass(classId, side);
  } catch (err) {
    throw toActionError(err, "Erro ao inscrever");
  }
}

// Inscreve o usuário logado. O `onSuccess` espera "minhas aulas"
// recarregar antes de a mutation terminar — é de lá que o card sabe que a
// pessoa está inscrita, então sem esperar o botão "Quero participar"
// piscaria de volta por um instante.
export function useEnrollStudent(classId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (side: Side) => enrollStudent(classId, side),
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
