import { useQuery } from "@tanstack/react-query";
import { aulaService, queryKeys } from "@domain";
import { LIVE_REFRESH_INTERVAL_MS, toActionError } from "@utils";

async function getClassesByDate(date: string) {
  try {
    return await aulaService.getClassesByDate(date);
  } catch (err) {
    throw toActionError(err, "Erro ao carregar aulas");
  }
}

export function useGetClassesByDate(date: string) {
  return useQuery({
    queryKey: queryKeys.classes.byDate(date),
    queryFn: () => getClassesByDate(date),
    refetchInterval: LIVE_REFRESH_INTERVAL_MS,
  });
}
