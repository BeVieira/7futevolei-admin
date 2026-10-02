import { useQuery } from "@tanstack/react-query";
import { authService } from "@domain/auth/service";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

// A tentativa de login vale 10 min no backend; uma nova é pedida antes
// disso, pra quem fica parado na tela não clicar com um nonce vencido.
const NONCE_RENEW_INTERVAL_MS = 8 * 60 * 1000;

async function loadGoogleSignIn() {
  try {
    await authService.loadGoogleSignIn();
    return await authService.startGoogleLogin();
  } catch (err) {
    throw toActionError(err, "Não foi possível carregar o login do Google");
  }
}

// Carrega o script do Google Identity Services e começa uma tentativa de
// login; `data` é o nonce pra a tela desenhar o botão
// (`authService.renderGoogleSignInButton`). `gcTime: 0`: ao sair da tela o
// nonce é descartado — cada visita ao login começa uma tentativa nova (o
// nonce é de uso único).
export function useLoadGoogleSignIn() {
  return useQuery({
    queryKey: queryKeys.auth.googleSignIn,
    queryFn: loadGoogleSignIn,
    retry: false,
    staleTime: NONCE_RENEW_INTERVAL_MS,
    refetchInterval: NONCE_RENEW_INTERVAL_MS,
    refetchOnWindowFocus: false,
    gcTime: 0,
  });
}
