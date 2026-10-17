import { useQuery } from "@tanstack/react-query";
import { aulaService } from "@domain/aula/service";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

async function getOpeningNotificationToday() {
  try {
    return await aulaService.getOpeningNotificationToday();
  } catch (err) {
    throw toActionError(err, "Erro ao carregar o último aviso de turmas");
  }
}

// `data: null` = ainda não houve aviso de turmas abertas hoje.
export function useGetOpeningNotificationToday() {
  return useQuery({
    queryKey: queryKeys.classes.openingNotificationToday,
    queryFn: () => getOpeningNotificationToday(),
  });
}
