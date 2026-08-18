import { useMutation, useQueryClient } from "@tanstack/react-query";
import { aulaService, TimeSlotInput, queryKeys } from "@domain";
import { toActionError } from "@utils";

async function createClassesForDay(
  date: string,
  timeSlots: TimeSlotInput[],
  lockAt?: string,
) {
  try {
    return await aulaService.createClassesForDay(date, timeSlots, lockAt);
  } catch (err) {
    throw toActionError(err, "Erro ao criar turmas");
  }
}

export function useCreateClassesForDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      date: string;
      timeSlots: TimeSlotInput[];
      lockAt?: string;
    }) => createClassesForDay(vars.date, vars.timeSlots, vars.lockAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
    },
  });
}
