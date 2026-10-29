import { Button, PushInstallInstructions } from "@components";
import {
  useDismissPushInvite,
  useEnablePush,
  useGetPushInviteDismissed,
  useGetPushStatus,
} from "@domain";

// Convite contextual logo depois de se inscrever numa aula — o card só o
// renderiza na inscrição que acabou de dar certo. Por dentro, só aparece
// enquanto dá pra ativar (ou instalar, no iPhone) e o aluno ainda não
// decidiu: ativar ou "Agora não" esconde de vez neste aparelho. Depois
// disso, as notificações ficam só no perfil.
export function PushNotificationsInvite() {
  const { data: status } = useGetPushStatus();
  const { data: dismissed = true } = useGetPushInviteDismissed();
  const enableMutation = useEnablePush();
  const dismissMutation = useDismissPushInvite();

  if (dismissed) return null;
  if (status !== "disabled" && status !== "needs-install") return null;

  return (
    <div className="flex flex-col gap-2 rounded-md bg-accent-soft p-3">
      {status === "needs-install" ? (
        <PushInstallInstructions />
      ) : (
        <>
          <p className="text-sm font-medium text-accent-ink">
            Quer ser avisado se sair da lista de espera ou na hora de enviar o
            comprovante?
          </p>
          <Button
            type="button"
            disabled={enableMutation.isPending}
            onClick={() => enableMutation.mutate()}
          >
            {enableMutation.isPending ? "Ativando..." : "Ativar notificações"}
          </Button>
        </>
      )}
      {enableMutation.error && (
        <p className="text-xs text-negative">{enableMutation.error.message}</p>
      )}
      <Button
        type="button"
        variant="secondary"
        disabled={enableMutation.isPending}
        onClick={() => dismissMutation.mutate()}
      >
        Agora não
      </Button>
    </div>
  );
}
