import { useQuery } from "@tanstack/react-query";
import { authService } from "@domain/auth/service";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

async function loadGoogleSignIn() {
  try {
    await authService.loadGoogleSignIn();
    return true;
  } catch (err) {
    throw toActionError(err, "Não foi possível carregar o login do Google");
  }
}

// Carrega o script do Google Identity Services; com `isSuccess` a tela pode
// desenhar o botão (`authService.renderGoogleSignInButton`).
export function useLoadGoogleSignIn() {
  return useQuery({
    queryKey: queryKeys.auth.googleSignIn,
    queryFn: loadGoogleSignIn,
    retry: false,
    staleTime: Infinity,
  });
}
