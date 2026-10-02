import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@components";
import {
  authService,
  useClaimGoogleLogin,
  useGetMe,
  useLoadGoogleSignIn,
} from "@domain";

type LocationState = { from?: string } | null;

// Entrar com Google pelo fluxo de redirect: o botão leva a página pro
// Google, que posta o resultado no backend (/api/auth/google/callback); o
// backend manda de volta pra cá com:
// - `?status=ok` — sessão aberta neste navegador;
// - `?status=confirmado` — login validado, mas o Google voltou num
//   navegador sem o cookie da tentativa: quem tem o segredo guardado (este
//   app, se foi ele que pediu) resgata a sessão (`useClaimGoogleLogin`);
// - `?erro=<código>`.
// O caminho pra onde voltar depois fica guardado antes de sair (ver
// `authService.rememberLoginReturnPath`).
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const buttonRef = useRef<HTMLDivElement>(null);

  const status = searchParams.get("status");
  const errorCode = searchParams.get("erro");
  const from = (location.state as LocationState)?.from;

  // Lido antes de a tela começar uma tentativa nova (que grava um segredo
  // novo): diz se este navegador já tinha pedido um login antes de chegar
  // aqui.
  const [hadPendingLogin] = useState(() => authService.hasPendingGoogleLogin());

  const { data: me, isLoading: isLoadingMe } = useGetMe();
  const { data: nonce, error: googleError } = useLoadGoogleSignIn();
  const claimMutation = useClaimGoogleLogin();
  const { mutate: claim, isPending: isClaiming } = claimMutation;

  // Na ida (sem resultado do Google na URL), guarda pra onde voltar. Na
  // volta, não sobrescreve — é justamente o que vai ser usado agora.
  useEffect(() => {
    if (!status && !errorCode) {
      authService.rememberLoginReturnPath(from ?? "/");
    }
  }, [status, errorCode, from]);

  // `takeLoginReturnPath` lê e apaga — o ref impede uma segunda leitura
  // (StrictMode roda o efeito duas vezes em dev) de achar o storage vazio e
  // mandar pra "/" por cima do destino certo.
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (me && !redirectedRef.current) {
      redirectedRef.current = true;
      authService.forgetPendingGoogleLogins();
      navigate(authService.takeLoginReturnPath(), { replace: true });
    }
  }, [me, navigate]);

  // Resgate (plano B do app instalado no iPhone — ver ARCHITECTURE.md):
  // se este aparelho começou uma tentativa e ainda não há sessão, tenta
  // resgatar ao abrir com `?status=confirmado` e sempre que a tela volta a
  // ficar visível (a pessoa fechou o navegador sobreposto onde o Google
  // voltou). Sem tentativa pendente, não chama nada.
  useEffect(() => {
    if (me || isLoadingMe) return;

    function tryClaim() {
      if (
        document.visibilityState === "visible" &&
        !isClaiming &&
        authService.hasPendingGoogleLogin()
      ) {
        claim();
      }
    }

    if (status === "confirmado") tryClaim();

    document.addEventListener("visibilitychange", tryClaim);
    window.addEventListener("focus", tryClaim);
    window.addEventListener("pageshow", tryClaim);
    return () => {
      document.removeEventListener("visibilitychange", tryClaim);
      window.removeEventListener("focus", tryClaim);
      window.removeEventListener("pageshow", tryClaim);
    };
  }, [me, isLoadingMe, status, isClaiming, claim]);

  useEffect(() => {
    if (nonce && !me && buttonRef.current) {
      authService.renderGoogleSignInButton(buttonRef.current, nonce);
    }
  }, [nonce, me, isLoadingMe]);

  // O Google voltou com sucesso, mas não há sessão: o navegador recusou os
  // cookies (ex: bloqueio de cookies ligado).
  const sessionNotKept = status === "ok" && !isLoadingMe && !me;

  // Login confirmado, mas este navegador não tem como resgatá-lo: é o
  // navegador "de fora" onde o Google voltou — a sessão vai abrir no app
  // que pediu o login.
  const confirmedElsewhere =
    status === "confirmado" && !isLoadingMe && !me && !hadPendingLogin;

  const errorMessage = errorCode
    ? authService.loginErrorMessage(errorCode)
    : sessionNotKept
      ? "O login funcionou, mas o navegador não guardou a sessão. Verifique se os cookies estão liberados e tente de novo."
      : (claimMutation.error?.message ?? googleError?.message ?? null);

  if (isLoadingMe || me) {
    return <p className="text-slate-500">Carregando...</p>;
  }

  return (
    <div className="flex justify-center">
      <Card className="flex w-full max-w-sm flex-col items-center gap-4">
        <h1 className="text-lg font-semibold text-slate-800">Entrar</h1>
        {confirmedElsewhere ? (
          <p className="text-center text-sm text-slate-600">
            Login confirmado. Volte para o app 7Futevôlei para continuar — pode
            fechar esta janela.
          </p>
        ) : (
          <p className="text-center text-sm text-slate-600">
            Use sua conta Google para se inscrever nas aulas, ver suas
            inscrições e enviar comprovantes.
          </p>
        )}
        {isClaiming && (
          <p className="text-center text-sm text-slate-500">
            Concluindo o login...
          </p>
        )}
        <div
          ref={buttonRef}
          className={`min-h-[44px] w-full justify-center ${
            confirmedElsewhere ? "hidden" : "flex"
          }`}
        />
        {errorMessage && (
          <p className="text-center text-sm text-red-600">{errorMessage}</p>
        )}
      </Card>
    </div>
  );
}
