import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as enrollmentService from "../service";
import type * as enrollmentTypes from "../types";
import { queryKeys } from "../../queryKeys";
import { toActionError } from "../../../utils/errors";

async function enrollStudent(
  classId: number,
  studentName: string,
  side: enrollmentTypes.Side,
) {
  try {
    await enrollmentService.enrollStudentInClass(classId, studentName, side);
    enrollmentService.rememberMyEnrollment(classId, studentName);
  } catch (err) {
    throw toActionError(err, "Erro ao inscrever");
  }
}

export function useEnrollStudent(classId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { studentName: string; side: enrollmentTypes.Side }) =>
      enrollStudent(classId, vars.studentName, vars.side),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all });
    },
  });
}
