import { useEffect } from "react";
import {
  pushService,
  useDisablePush,
  useEnablePush,
  useGetPushStatus,
} from "@domain";
import { Button } from "./Button";

type Props = {
  // Aluno dono deste aparelho — vincula a inscrição de push ao nome usado em
  // "Minhas Aulas". Omitido no admin, pra não sobrescrever o vínculo.
  studentName?: string;
};

export function PushNotificationsControl({ studentName }: Props) {
  const { data: status } = useGetPushStatus();
  const enableMutation = useEnablePush();
  const disableMutation = useDisablePush();

  useEffect(() => {
    if (status === "enabled" && studentName) {
      pushService.syncStudentName(studentName).catch(() => {});
    }
  }, [status, studentName]);

  if (!status) return null;

  if (status === "unsupported") {
    return (
      <p className="text-sm text-slate-500">
        Este navegador não suporta notificações.
      </p>
    );
  }

  if (status === "needs-install") {
    return (
      <div className="flex flex-col gap-1 text-sm text-slate-600">
        <p className="font-medium text-slate-700">
          Quer receber notificações no iPhone?
        </p>
        <p>
          Adicione o app à tela de início: toque em{" "}
          <span className="font-medium">Compartilhar</span> (o quadrado com a
          seta) e depois em{" "}
          <span className="font-medium">Adicionar à Tela de Início</span>. Abra
          o app pelo ícone novo e ative as notificações por lá.
        </p>
      </div>
    );
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
        <Button
          type="button"
          disabled={isPending}
          onClick={() => enableMutation.mutate(studentName)}
        >
          {isPending ? "Ativando..." : "Ativar notificações"}
        </Button>
      )}
      {error && <p className="text-sm text-red-600">{error.message}</p>}
    </div>
  );
}
