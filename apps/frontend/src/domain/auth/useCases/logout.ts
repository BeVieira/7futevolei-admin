import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "@domain/auth/service";
import { pushService } from "@domain/push/service";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

// Ponto único de saída do app. Desinscreve o push deste aparelho antes de
// derrubar a sessão, pra ele não continuar recebendo avisos da conta que
// saiu. A rota de unsubscribe é pública (o endpoint prova a posse) e
// `disable()` desfaz a inscrição do navegador mesmo se o backend falhar,
// então isso não depende da sessão — e é best-effort: se falhar (sem
// permissão, push não suportado), a pessoa sai mesmo assim.
async function logout() {
  await pushService.disable().catch(() => {});

  try {
    await authService.logout();
  } catch (err) {
    throw toActionError(err, "Erro ao sair");
  }
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    // Nada do usuário anterior sobra em cache (inscrições, detalhe de
    // turma do admin, busca de usuários, status do push...): limpa tudo e
    // já marca "ninguém logado", pra o cabeçalho não piscar carregando.
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.auth.me, null);
    },
  });
}
