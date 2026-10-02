import { useQuery } from "@tanstack/react-query";
import { enrollmentService } from "@domain/enrollment/service";
import { queryKeys } from "@domain/queryKeys";
import { LIVE_REFRESH_INTERVAL_MS, toActionError } from "@utils";

async function getMyEnrollments() {
  try {
    return await enrollmentService.getMyEnrollments();
  } catch (err) {
    throw toActionError(err, "Erro ao carregar suas inscrições");
  }
}

// Inscrições do usuário logado. `enabled: false` pra quem não está logado
// (a rota exige sessão — chamar sem login só geraria um 401).
export function useGetMyEnrollments(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: queryKeys.enrollments.mine,
    queryFn: getMyEnrollments,
    enabled,
    refetchInterval: enabled ? LIVE_REFRESH_INTERVAL_MS : false,
  });
}
