import { FormEvent, useState } from "react";
import { Button, Card } from "../../../components";
import {
  enrollmentService,
  MyEnrollmentSummary,
} from "../../../domain/enrollment";
import { receiptService, useSubmitReceipt } from "../../../domain/receipt";
import { formatDateLabel } from "../../../utils/date";

type Props = {
  entry: MyEnrollmentSummary;
  studentName: string;
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  PENDING: "bg-amber-100 text-amber-700",
};

export function MyEnrollmentCard({ entry, studentName }: Props) {
  const { classSession, enrollment, receipt } = entry;
  const [file, setFile] = useState<File | null>(null);

  const submitMutation = useSubmitReceipt(
    classSession.id,
    enrollment.id,
    studentName,
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    submitMutation.mutate(file, { onSuccess: () => setFile(null) });
  }

  const canUpload = !receipt || receipt.status === "REJECTED";

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-800">
          {classSession.classLevel}
        </span>
        <span className="text-xs text-slate-500">
          {enrollment.status === "WAITLISTED"
            ? "Lista de espera"
            : "Confirmado"}
        </span>
      </div>
      <p className="text-sm text-slate-600">
        {formatDateLabel(classSession.date.slice(0, 10))} ·{" "}
        {classSession.startTime}–{classSession.endTime} ·{" "}
        {enrollmentService.sideLabel(enrollment.side)}
      </p>

      {receipt && (
        <div className="flex flex-col gap-1">
          <span
            className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[receipt.status]}`}
          >
            {receiptService.receiptStatusLabel(receipt.status)}
          </span>
          {receipt.status === "PENDING" && (
            <a
              href={receiptService.getReceiptFileUrl(receipt.filePath)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-teal-600 underline"
            >
              Ver comprovante enviado
            </a>
          )}
          {receipt.status === "REJECTED" && receipt.adminComment && (
            <p className="text-xs text-red-700">{receipt.adminComment}</p>
          )}
        </div>
      )}

      {canUpload && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-slate-600"
          />
          {submitMutation.isError && (
            <p className="text-xs text-red-600">
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
