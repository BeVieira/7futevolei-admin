import { useQuery } from "@tanstack/react-query";
import { aulaService, queryKeys } from "@domain";
import { toActionError } from "@utils";

async function getNextAvailableDate() {
  try {
    return await aulaService.getNextAvailableDate();
  } catch (err) {
    throw toActionError(err, "Erro ao carregar próxima data com aulas");
  }
}

export function useGetNextAvailableDate() {
  return useQuery({
    queryKey: queryKeys.classes.nextAvailableDate,
    queryFn: () => getNextAvailableDate(),
  });
}
