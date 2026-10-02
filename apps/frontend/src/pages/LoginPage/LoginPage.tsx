import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@components";
import { authService, useGetMe, useLoadGoogleSignIn } from "@domain";

type LocationState = { from?: string } | null;

// Entrar com Google pelo fluxo de redirect: o botão leva a página pro
// Google, que posta o resultado no backend (/api/auth/google/callback); o
// backend grava os cookies e manda de volta pra cá com `?status=ok` ou
// `?erro=<código>`. O caminho pra onde voltar depois fica guardado antes de
// sair (ver `authService.rememberLoginReturnPath`).
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const buttonRef = useRef<HTMLDivElement>(null);

  const returningFromGoogle = searchParams.get("status") === "ok";
  const errorCode = searchParams.get("erro");
  const from = (location.state as LocationState)?.from;

  const { data: me, isLoading: isLoadingMe } = useGetMe();
  const { data: nonce, error: googleError } = useLoadGoogleSignIn();

  // Na ida (sem resultado do Google na URL), guarda pra onde voltar. Na
  // volta, não sobrescreve — é justamente o que vai ser usado agora.
  useEffect(() => {
    if (!returningFromGoogle && !errorCode) {
      authService.rememberLoginReturnPath(from ?? "/");
    }
  }, [returningFromGoogle, errorCode, from]);

  // `takeLoginReturnPath` lê e apaga — o ref impede uma segunda leitura
  // (StrictMode roda o efeito duas vezes em dev) de achar o storage vazio e
  // mandar pra "/" por cima do destino certo.
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (me && !redirectedRef.current) {
      redirectedRef.current = true;
      navigate(authService.takeLoginReturnPath(), { replace: true });
    }
  }, [me, navigate]);

  useEffect(() => {
    if (nonce && !me && buttonRef.current) {
      authService.renderGoogleSignInButton(buttonRef.current, nonce);
    }
  }, [nonce, me, isLoadingMe]);

  // O Google voltou com sucesso, mas não há sessão: o navegador recusou os
  // cookies (ex: bloqueio de cookies ligado).
  const sessionNotKept = returningFromGoogle && !isLoadingMe && !me;

  const errorMessage = errorCode
    ? authService.loginErrorMessage(errorCode)
    : sessionNotKept
      ? "O login funcionou, mas o navegador não guardou a sessão. Verifique se os cookies estão liberados e tente de novo."
      : (googleError?.message ?? null);

  if (isLoadingMe || me) {
    return <p className="text-slate-500">Carregando...</p>;
  }

  return (
    <div className="flex justify-center">
      <Card className="flex w-full max-w-sm flex-col items-center gap-4">
        <h1 className="text-lg font-semibold text-slate-800">Entrar</h1>
        <p className="text-center text-sm text-slate-600">
          Use sua conta Google para se inscrever nas aulas, ver suas inscrições
          e enviar comprovantes.
        </p>
        <div
          ref={buttonRef}
          className="flex min-h-[44px] w-full justify-center"
        />
        {errorMessage && (
          <p className="text-center text-sm text-red-600">{errorMessage}</p>
        )}
      </Card>
    </div>
  );
}
