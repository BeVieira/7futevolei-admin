import { useQuery } from "@tanstack/react-query";
import { enrollmentService } from "@domain/enrollment/service";
import { queryKeys } from "@domain/queryKeys";
import { LIVE_REFRESH_INTERVAL_MS, toActionError } from "@utils";

async function getGuestEnrollments() {
  try {
    return await enrollmentService.getGuestEnrollments();
  } catch (err) {
    throw toActionError(err, "Erro ao carregar suas inscrições");
  }
}

// Inscrições sem conta feitas deste aparelho (pelos códigos guardados no
// navegador). Sem nenhum código guardado não chama o backend — só atualiza
// ao vivo quando há o que acompanhar (ex: sair da lista de espera).
export function useGetGuestEnrollments() {
  return useQuery({
    queryKey: queryKeys.enrollments.guest,
    queryFn: getGuestEnrollments,
    refetchInterval: () =>
      enrollmentService.hasGuestEnrollments()
        ? LIVE_REFRESH_INTERVAL_MS
        : false,
  });
}
