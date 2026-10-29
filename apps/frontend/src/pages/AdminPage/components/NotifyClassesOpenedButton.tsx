import { useState } from "react";
import { Button, Modal } from "@components";
import {
  ClassOpeningNotification,
  useGetOpeningNotificationToday,
  useNotifyClassesOpened,
} from "@domain";
import { formatDateLabel, pluralize } from "@utils";

type Props = {
  date: string;
  disabled: boolean;
};

function formatSentAt(sentAt: string): string {
  return new Date(sentAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Botão "Notificar alunos": avisa por push que as turmas de `date` estão
// abertas. Se já houve aviso hoje, pede confirmação antes de mandar outro.
export function NotifyClassesOpenedButton({ date, disabled }: Props) {
  const { data: lastSentToday, isLoading } = useGetOpeningNotificationToday();
  const notifyMutation = useNotifyClassesOpened();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function notify(force: boolean) {
    setConfirmOpen(false);
    notifyMutation.mutate({ date, force });
  }

  function handleClick() {
    if (lastSentToday) {
      setConfirmOpen(true);
    } else {
      notify(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={disabled || isLoading || notifyMutation.isPending}
      >
        {notifyMutation.isPending ? "Notificando..." : "Notificar alunos"}
      </Button>

      {notifyMutation.isSuccess && (
        <p className="text-right text-xs text-muted">
          Aviso enviado para{" "}
          {pluralize(notifyMutation.data.devicesNotified, "aparelho", "aparelhos")}
          .
        </p>
      )}
      {notifyMutation.isError && (
        <p className="text-right text-xs text-negative">
          {notifyMutation.error.message}
        </p>
      )}

      {confirmOpen && lastSentToday && (
        <NotifyAgainModal
          lastSentToday={lastSentToday}
          onConfirm={() => notify(true)}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}

function NotifyAgainModal({
  lastSentToday,
  onConfirm,
  onClose,
}: {
  lastSentToday: ClassOpeningNotification;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Notificar novamente?" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Já foi enviado um aviso de turmas abertas hoje às{" "}
          <span className="num font-medium text-ink">
            {formatSentAt(lastSentToday.sentAt)}
          </span>{" "}
          (aulas de {formatDateLabel(lastSentToday.classDate)}). Enviar de novo
          manda outra notificação para todos os alunos.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm}>
            Notificar novamente
          </Button>
        </div>
      </div>
    </Modal>
  );
}
