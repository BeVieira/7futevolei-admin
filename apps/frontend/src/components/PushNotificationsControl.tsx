import { useDisablePush, useEnablePush, useGetPushStatus } from "@domain";
import { Button } from "./Button";
import { PushInstallInstructions } from "./PushInstallInstructions";

// Ativar/desativar as notificações deste aparelho para o usuário logado (a
// sessão identifica o dono da inscrição — sem props). Fica no perfil.
export function PushNotificationsControl() {
  const { data: status } = useGetPushStatus();
  const enableMutation = useEnablePush();
  const disableMutation = useDisablePush();

  if (!status) return null;

  if (status === "unsupported") {
    return (
      <p className="text-sm text-slate-500">
        Este navegador não suporta notificações.
      </p>
    );
  }

  if (status === "needs-install") {
    return <PushInstallInstructions />;
  }

  if (status === "denied") {
    return (
      <p className="text-sm text-slate-500">
        As notificações estão bloqueadas neste aparelho. Para receber, libere
        nas configurações do navegador para este site.
      </p>
    );
  }

  const error = enableMutation.error ?? disableMutation.error;
  const isPending = enableMutation.isPending || disableMutation.isPending;

  return (
    <div className="flex flex-col gap-2">
      {status === "enabled" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Notificações ativadas neste aparelho.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => disableMutation.mutate()}
          >
            Desativar
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            Receba um aviso quando sair da lista de espera, se sua inscrição
            mudar e na hora de enviar o comprovante.
          </p>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => enableMutation.mutate()}
          >
            {isPending ? "Ativando..." : "Ativar notificações"}
          </Button>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error.message}</p>}
    </div>
  );
}
