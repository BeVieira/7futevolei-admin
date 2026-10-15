import { useMutation } from "@tanstack/react-query";
import { installService } from "@domain/install/service";

// Abre o pedido nativo de instalação (Chrome/Edge/Android). `data` diz se o
// usuário aceitou.
export function usePromptInstall() {
  return useMutation({ mutationFn: installService.promptInstall });
}
