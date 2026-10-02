import { useQuery } from "@tanstack/react-query";
import { pushService } from "@domain/push/service";
import { queryKeys } from "@domain/queryKeys";

// Estado local do navegador (permissão + inscrição), não do servidor. O
// refetch ao voltar pra aba (padrão do react-query) pega permissão alterada
// nas configurações do aparelho nesse meio-tempo.
export function useGetPushStatus() {
  return useQuery({
    queryKey: queryKeys.push.status,
    queryFn: pushService.getStatus,
    retry: false,
  });
}
