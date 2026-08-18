import { useQuery } from "@tanstack/react-query";
import { enrollmentService } from "../service";
import { queryKeys } from "../../queryKeys";
import { toActionError } from "../../../utils/errors";
import { LIVE_REFRESH_INTERVAL_MS } from "../../../utils/realtime";

async function getMyEnrollments(studentName: string) {
  try {
    return await enrollmentService.getEnrollmentsByStudentName(studentName);
  } catch (err) {
    throw toActionError(err, "Erro ao carregar suas inscrições");
  }
}

export function useGetMyEnrollments(studentName: string) {
  return useQuery({
    queryKey: queryKeys.enrollments.myEnrollments(studentName),
    queryFn: () => getMyEnrollments(studentName),
    enabled: !!studentName,
    refetchInterval: LIVE_REFRESH_INTERVAL_MS,
  });
}
