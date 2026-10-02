import { useQuery } from "@tanstack/react-query";
import { aulaService } from "@domain/aula/service";
import { queryKeys } from "@domain/queryKeys";
import { LIVE_REFRESH_INTERVAL_MS, toActionError } from "@utils";

async function getClassAdminDetailById(id: number) {
  try {
    return await aulaService.getClassAdminDetailById(id);
  } catch (err) {
    throw toActionError(err, "Erro ao carregar a aula");
  }
}

// Detalhe da turma na visão do admin: quem é convidado (`userId` null) e os
// comprovantes. Rota protegida por `requireAdmin` — uma sessão vencida
// responde 401 e o `apiFetch` renova antes de repetir, em vez de cair
// silenciosamente na visão pública.
export function useGetClassAdminDetailById(id: number) {
  return useQuery({
    queryKey: queryKeys.classes.adminDetail(id),
    queryFn: () => getClassAdminDetailById(id),
    refetchInterval: LIVE_REFRESH_INTERVAL_MS,
  });
}
