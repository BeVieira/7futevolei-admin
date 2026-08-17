import { useQuery } from "@tanstack/react-query";
import * as aulaService from "../service";
import { queryKeys } from "../../queryKeys";
import { toActionError } from "../../../utils/errors";
import { LIVE_REFRESH_INTERVAL_MS } from "../../../utils/realtime";

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
