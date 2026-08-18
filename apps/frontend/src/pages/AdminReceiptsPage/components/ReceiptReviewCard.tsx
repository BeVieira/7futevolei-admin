import { useState } from "react";
import { Card, ClassSessionCard } from "../../../components";
import { useGetClassById } from "../../../domain/aula";
import { enrollmentService, enrollmentTypes } from "../../../domain/enrollment";
import { receiptService, useReviewReceipt } from "../../../domain/receipt";

type Props = {
  sessionId: number;
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  PENDING: "bg-amber-100 text-amber-700",
};

type EntryWithListLabel = enrollmentTypes.EnrollmentSummary & {
  listLabel: string;
};

export function ReceiptReviewCard({ sessionId }: Props) {
  const { data: detail, isLoading } = useGetClassById(sessionId);

  if (isLoading || !detail) {
    return (
      <Card>
        <p className="text-sm text-slate-400">Carregando...</p>
      </Card>
    );
  }

  const entries: EntryWithListLabel[] = [
    ...detail.confirmed.map((e) => ({ ...e, listLabel: "Confirmado" })),
    ...detail.waitlist.map((e) => ({ ...e, listLabel: "Lista de espera" })),
  ];
  const approvedCount = entries.filter(
    (e) => e.receipt?.status === "APPROVED",
  ).length;
  const allApproved = entries.length > 0 && approvedCount === entries.length;

  return (
    <ClassSessionCard
      title={detail.classLevel}
      headerRight={
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            allApproved
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {approvedCount}/{entries.length} aprovados
        </span>
      }
    >
      <p className="text-sm text-slate-500">
        {detail.startTime} - {detail.endTime}
      </p>

      {entries.length === 0 && (
        <p className="text-xs text-slate-400">Ninguém inscrito.</p>
      )}

      <ul className="flex flex-col gap-2">
        {entries.map((enrollment) => (
          <ReceiptReviewRow
            key={enrollment.id}
            sessionId={sessionId}
            enrollment={enrollment}
          />
        ))}
      </ul>
    </ClassSessionCard>
  );
}

type RowProps = {
  sessionId: number;
  enrollment: EntryWithListLabel;
};

function ReceiptReviewRow({ sessionId, enrollment }: RowProps) {
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");
  const reviewMutation = useReviewReceipt(sessionId, enrollment.id);
  const { receipt } = enrollment;

  function handleApprove() {
    reviewMutation.mutate({ status: "APPROVED" });
  }

  function handleConfirmReject() {
    if (!comment.trim()) return;
    reviewMutation.mutate(
      { status: "REJECTED", adminComment: comment.trim() },
      {
        onSuccess: () => {
          setRejecting(false);
          setComment("");
        },
      },
    );
  }

  return (
    <li className="flex flex-col gap-1 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-slate-700">
          {enrollment.studentName}{" "}
          <span className="text-xs text-slate-400">
            ({enrollmentService.sideLabel(enrollment.side)} ·{" "}
            {enrollment.listLabel})
          </span>
        </span>
        {receipt && (
          <span
            className={`inline-flex w-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[receipt.status]}`}
          >
            {receiptService.receiptStatusLabel(receipt.status)}
          </span>
        )}
      </div>

      {!receipt && (
        <p className="text-xs text-slate-400">Sem comprovante enviado.</p>
      )}

      {receipt && (
        <div className="flex flex-col gap-1">
          <a
            href={receiptService.getReceiptFileUrl(receipt.filePath)}
            target="_blank"
            rel="noreferrer"
            className="w-fit text-xs text-teal-600 underline"
          >
            Ver comprovante
          </a>

          {receipt.status === "REJECTED" && receipt.adminComment && (
            <p className="text-xs text-red-700">{receipt.adminComment}</p>
          )}

          {receipt.status === "PENDING" && (
            <>
              {reviewMutation.isError && (
                <p className="text-xs text-red-600">
                  {reviewMutation.error.message}
                </p>
              )}
              {!rejecting ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={reviewMutation.isPending}
                    className="text-xs font-medium text-emerald-600 underline"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(true)}
                    disabled={reviewMutation.isPending}
                    className="text-xs font-medium text-red-600 underline"
                  >
                    Negar
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <textarea
                    autoFocus
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Motivo da recusa"
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleConfirmReject}
                      disabled={!comment.trim() || reviewMutation.isPending}
                      className="text-xs font-medium text-red-600 underline disabled:text-slate-300"
                    >
                      Confirmar recusa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejecting(false);
                        setComment("");
                      }}
                      disabled={reviewMutation.isPending}
                      className="text-xs font-medium text-slate-500 underline"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}
