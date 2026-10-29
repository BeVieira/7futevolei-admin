import { useState } from "react";
import { Card, ClassSessionCard, GuestBadge } from "@components";
import {
  AdminEnrollmentSummary,
  enrollmentService,
  receiptService,
  useGetClassAdminDetailById,
  useReviewReceipt,
} from "@domain";

type Props = {
  sessionId: number;
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  APPROVED: "bg-positive-bg text-positive-ink",
  REJECTED: "bg-negative-bg text-negative-ink",
  PENDING: "border border-warning-border bg-warning-bg text-warning-ink",
};

type EntryWithListLabel = AdminEnrollmentSummary & {
  listLabel: string;
};

export function ReceiptReviewCard({ sessionId }: Props) {
  const { data: detail, isLoading } = useGetClassAdminDetailById(sessionId);

  if (isLoading || !detail) {
    return (
      <Card>
        <p className="text-sm text-muted">Carregando...</p>
      </Card>
    );
  }

  const entries: EntryWithListLabel[] = [
    ...detail.confirmed.map(e => ({ ...e, listLabel: "Confirmado" })),
    ...detail.waitlist.map(e => ({ ...e, listLabel: "Lista de espera" })),
  ];
  const approvedCount = entries.filter(
    e => e.receipt?.status === "APPROVED",
  ).length;
  const allApproved = entries.length > 0 && approvedCount === entries.length;

  return (
    <ClassSessionCard
      title={detail.classLevel}
      occupancy={{ filled: approvedCount, total: entries.length }}
      headerRight={
        <span
          className={`num whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
            allApproved
              ? "bg-positive-bg text-positive-ink"
              : "bg-raised text-muted"
          }`}
        >
          {approvedCount}/{entries.length} aprovados
        </span>
      }
    >
      <p className="num text-[13px] text-muted">
        {detail.startTime} - {detail.endTime}
      </p>

      {entries.length === 0 && (
        <p className="text-sm text-muted">Ninguém inscrito.</p>
      )}

      <ul className="flex flex-col divide-y divide-rule">
        {entries.map(enrollment => (
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
    <li className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
          <span className="font-medium text-ink">{enrollment.studentName}</span>
          {enrollmentService.isGuest(enrollment) && <GuestBadge />}
          <span className="text-xs text-muted">
            {enrollmentService.sideLabel(enrollment.side)} ·{" "}
            {enrollment.listLabel}
          </span>
        </span>
        {receipt && (
          <span
            className={`flex-none whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[receipt.status]}`}
          >
            {receiptService.receiptStatusLabel(receipt.status)}
          </span>
        )}
      </div>

      {!receipt && (
        <p className="text-xs text-muted">
          {enrollmentService.isGuest(enrollment)
            ? "Convidado — não envia comprovante pelo app."
            : "Sem comprovante enviado."}
        </p>
      )}

      {receipt && (
        <div className="flex flex-col gap-1">
          <a
            href={receipt.filePath}
            target="_blank"
            rel="noreferrer"
            className="text-action w-fit text-accent-ink"
          >
            Ver comprovante
          </a>

          {receipt.status === "REJECTED" && receipt.adminComment && (
            <p className="text-sm text-negative-ink">{receipt.adminComment}</p>
          )}

          {receipt.status === "PENDING" && (
            <>
              {reviewMutation.isError && (
                <p className="text-sm text-negative">
                  {reviewMutation.error.message}
                </p>
              )}
              {!rejecting ? (
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={reviewMutation.isPending}
                    className="text-action text-positive"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(true)}
                    disabled={reviewMutation.isPending}
                    className="text-action text-negative"
                  >
                    Negar
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Motivo da recusa"
                    rows={2}
                    aria-label="Motivo da recusa"
                    className="field"
                  />
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={handleConfirmReject}
                      disabled={!comment.trim() || reviewMutation.isPending}
                      className="text-action text-negative"
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
                      className="text-action text-muted"
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
