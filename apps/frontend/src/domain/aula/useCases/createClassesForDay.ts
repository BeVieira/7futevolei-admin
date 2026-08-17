import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as aulaService from "../service";
import type * as aulaTypes from "../types";
import { queryKeys } from "../../queryKeys";
import { toActionError } from "../../../utils/errors";

async function createClassesForDay(
  date: string,
  timeSlots: aulaTypes.TimeSlotInput[],
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
      timeSlots: aulaTypes.TimeSlotInput[];
      lockAt?: string;
    }) => createClassesForDay(vars.date, vars.timeSlots, vars.lockAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
    },
  });
}
