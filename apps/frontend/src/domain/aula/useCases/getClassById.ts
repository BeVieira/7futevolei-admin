import { useQuery } from "@tanstack/react-query";
import * as aulaService from "../service";
import { queryKeys } from "../../queryKeys";
import { toActionError } from "../../../utils/errors";
import { LIVE_REFRESH_INTERVAL_MS } from "../../../utils/realtime";

async function getClassById(id: number) {
  try {
    return await aulaService.getClassById(id);
  } catch (err) {
    throw toActionError(err, "Erro ao carregar a aula");
  }
}

export function useGetClassById(id: number, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: queryKeys.classes.detail(id),
    queryFn: () => getClassById(id),
    enabled,
    refetchInterval: enabled ? LIVE_REFRESH_INTERVAL_MS : false,
  });
}
