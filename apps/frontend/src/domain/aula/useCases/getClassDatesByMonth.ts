import { useQuery } from "@tanstack/react-query";
import { aulaService, queryKeys } from "@domain";
import { toActionError } from "@utils";

async function getClassDatesByMonth(month: string) {
  try {
    return await aulaService.getClassDatesByMonth(month);
  } catch (err) {
    throw toActionError(err, "Erro ao carregar datas com aulas");
  }
}

export function useGetClassDatesByMonth(month: string) {
  return useQuery({
    queryKey: queryKeys.classes.byMonth(month),
    queryFn: () => getClassDatesByMonth(month),
  });
}
