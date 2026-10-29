import { FormEvent, useState } from "react";
import { Button, Card } from "@components";
import {
  MyEnrollmentSummary,
  enrollmentService,
  receiptService,
  useSubmitReceipt,
} from "@domain";
import { formatDateLabel } from "@utils";

type Props = {
  entry: MyEnrollmentSummary;
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  APPROVED: "bg-positive-bg text-positive-ink",
  REJECTED: "bg-negative-bg text-negative-ink",
  PENDING: "border border-warning-border bg-warning-bg text-warning-ink",
};

export function MyEnrollmentCard({ entry }: Props) {
  const { classSession, enrollment, receipt } = entry;
  const [file, setFile] = useState<File | null>(null);

  const submitMutation = useSubmitReceipt(classSession.id, enrollment.id);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    submitMutation.mutate(file, { onSuccess: () => setFile(null) });
  }

  const canUpload = !receipt || receipt.status === "REJECTED";

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold text-ink">
            {classSession.classLevel}
          </span>
          <span
            className={`flex-none whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
              enrollment.status === "WAITLISTED"
                ? "border border-warning-border bg-warning-bg text-warning-ink"
                : "bg-accent-soft text-accent-ink"
            }`}
          >
            {enrollment.status === "WAITLISTED"
              ? "Lista de espera"
              : "Confirmado"}
          </span>
        </div>
        <p className="num text-[13px] text-muted">
          {formatDateLabel(classSession.date)} ·{" "}
          {classSession.startTime}-{classSession.endTime} ·{" "}
          {enrollmentService.sideLabel(enrollment.side)}
        </p>
      </div>

      {receipt && (
        <div className="flex flex-col gap-1.5 rounded-md bg-background p-3">
          <span className="flex items-center justify-between gap-2 text-sm text-muted">
            Comprovante
            <span
              className={`flex-none whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[receipt.status]}`}
            >
              {receiptService.receiptStatusLabel(receipt.status)}
            </span>
          </span>
          {receipt.status === "PENDING" && (
            <a
              href={receipt.filePath}
              target="_blank"
              rel="noreferrer"
              className="text-action w-fit text-accent-ink"
            >
              Ver comprovante enviado
            </a>
          )}
          {receipt.status === "REJECTED" && receipt.adminComment && (
            <p className="text-sm text-negative-ink">{receipt.adminComment}</p>
          )}
        </div>
      )}

      {canUpload && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-muted file:mr-3 file:min-h-[40px] file:cursor-pointer file:rounded-md file:border-0 file:bg-raised file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-line"
          />
          {submitMutation.isError && (
            <p className="text-sm text-negative">
              {submitMutation.error.message}
            </p>
          )}
          <Button
            type="submit"
            disabled={!file || submitMutation.isPending}
            className="text-sm"
          >
            {submitMutation.isPending
              ? "Enviando..."
              : receipt
                ? "Reenviar comprovante"
                : "Enviar comprovante"}
          </Button>
        </form>
      )}
    </Card>
  );
}
