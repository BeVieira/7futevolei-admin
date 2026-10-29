import { useState } from "react";
import { AdminEnrollForm } from "./AdminEnrollForm";
import { Button, ClassSessionCard, GuestBadge } from "@components";
import { PeopleIcon } from "@assets";
import {
  AdminEnrollmentSummary,
  CLASS_LEVELS,
  ClassLevel,
  aulaService,
  enrollmentService,
  useDeleteClass,
  useGetClassAdminDetailById,
  useRemoveEnrollment,
  useUpdateClass,
} from "@domain";
import { buildLockTimeOptions, formatPreviousDayLabel } from "@utils";

type Props = {
  sessionId: number;
};

export function AdminClassSessionCard({ sessionId }: Props) {
  const [editing, setEditing] = useState(false);
  const [classLevel, setClassLevel] = useState<ClassLevel>("Iniciante");
  const [capacity, setCapacity] = useState(8);
  const [lockAt, setLockAt] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);

  const { data: detail, isLoading } = useGetClassAdminDetailById(sessionId);

  const updateMutation = useUpdateClass(sessionId);
  const deleteMutation = useDeleteClass(sessionId);
  const removeEnrollmentMutation = useRemoveEnrollment(sessionId);

  const busy =
    updateMutation.isPending ||
    deleteMutation.isPending ||
    removeEnrollmentMutation.isPending;

  const error =
    updateMutation.error ??
    deleteMutation.error ??
    removeEnrollmentMutation.error;

  function handleRemoveEnrollment(enrollmentId: number) {
    removeEnrollmentMutation.mutate(enrollmentId);
  }

  function startEditing() {
    if (!detail) return;
    setClassLevel(detail.classLevel);
    setCapacity(detail.capacity);
    setLockAt(detail.lockAt ?? "");
    setEditing(true);
  }

  if (isLoading || !detail) {
    return (
      <div className="rounded-lg border border-line bg-card p-4">
        <p className="text-sm text-muted">Carregando...</p>
      </div>
    );
  }

  const sideCapacity = aulaService.getSideCapacity(detail.capacity);
  const leftCount = detail.confirmed.filter(e => e.side === "LEFT").length;
  const rightCount = detail.confirmed.filter(e => e.side === "RIGHT").length;
  const totalEnrolled = detail.confirmedCount + detail.waitlistCount;

  return (
    <ClassSessionCard
      title={detail.classLevel}
      occupancy={{ filled: detail.confirmedCount, total: detail.capacity }}
      headerRight={
        <span className="num flex items-center gap-1.5 text-sm text-muted">
          <PeopleIcon className="h-4 w-4" />
          <span>
            <span className="font-semibold text-ink">{totalEnrolled}</span>/
            {detail.capacity}
          </span>
        </span>
      }
    >
      {editing ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {CLASS_LEVELS.map(option => (
              <label key={option} className="option">
                <input
                  type="radio"
                  name={`classLevel-${sessionId}`}
                  value={option}
                  checked={classLevel === option}
                  onChange={() => setClassLevel(option)}
                />
                {option}
              </label>
            ))}
          </div>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min={1}
            value={capacity}
            onChange={e => setCapacity(Number(e.target.value))}
            aria-label="Vagas"
            className="field"
          />
          <div>
            <label
              className="mb-2 block text-sm font-medium text-ink"
              htmlFor={`lockAt-${sessionId}`}
            >
              Trancar lista às (opcional)
            </label>
            <select
              id={`lockAt-${sessionId}`}
              value={lockAt}
              onChange={e => setLockAt(e.target.value)}
              className="field"
            >
              <option value="">Não trancar</option>
              {lockAt && !buildLockTimeOptions().includes(lockAt) && (
                <option value={lockAt}>{lockAt}</option>
              )}
              {buildLockTimeOptions().map(time => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted">
              Tranca no dia anterior (
              {formatPreviousDayLabel(detail.date.slice(0, 10))}).
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() =>
                updateMutation.mutate(
                  { classLevel, capacity, lockAt: lockAt || null },
                  { onSuccess: () => setEditing(false) },
                )
              }
              disabled={busy}
            >
              Salvar
            </Button>
            <Button
              variant="secondary"
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={startEditing}
            className="text-action text-ink"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => deleteMutation.mutate()}
            disabled={busy}
            className="text-action text-negative"
          >
            Remover
          </button>
        </div>
      )}

      {detail.lockAt && (
        <p
          className={`num text-xs font-medium ${detail.isLocked ? "text-negative" : "text-muted"}`}
        >
          {detail.isLocked
            ? `Lista trancada desde as ${detail.lockAt} de ${formatPreviousDayLabel(detail.date.slice(0, 10))}`
            : `Lista tranca às ${detail.lockAt} de ${formatPreviousDayLabel(detail.date.slice(0, 10))}`}
        </p>
      )}

      {error && <p className="text-sm text-negative">{error.message}</p>}

      <div>
        {detail.confirmed.length === 0 ? (
          <p className="text-sm text-muted">Ninguém inscrito ainda.</p>
        ) : (
          <p className="num mb-1 text-xs font-medium text-muted">
            Confirmados · {detail.confirmed.length}
          </p>
        )}
        <ul className="flex flex-col divide-y divide-rule">
          {detail.confirmed.map(enrollment => (
            <li
              key={enrollment.id}
              className="flex min-h-[40px] items-center justify-between gap-2 py-1.5 text-sm"
            >
              <EnrollmentLabel enrollment={enrollment} />
              <button
                type="button"
                onClick={() => handleRemoveEnrollment(enrollment.id)}
                disabled={busy}
                className="text-action shrink-0 text-negative"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      </div>

      {detail.waitlist.length > 0 && (
        <div>
          <p className="num mb-1 text-xs font-medium text-muted">
            Lista de espera · {detail.waitlist.length}
          </p>
          <ul className="flex flex-col divide-y divide-rule">
            {detail.waitlist.map(enrollment => (
              <li
                key={enrollment.id}
                className="flex min-h-[40px] items-center justify-between gap-2 py-1.5 text-sm"
              >
                <EnrollmentLabel enrollment={enrollment} />
                <button
                  type="button"
                  onClick={() => handleRemoveEnrollment(enrollment.id)}
                  disabled={busy}
                  className="text-action shrink-0 text-negative"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {addingStudent ? (
        <AdminEnrollForm
          sessionId={sessionId}
          sideCapacity={sideCapacity}
          leftCount={leftCount}
          rightCount={rightCount}
          onClose={() => setAddingStudent(false)}
        />
      ) : (
        <Button variant="secondary" onClick={() => setAddingStudent(true)}>
          Inscrever aluno
        </Button>
      )}
    </ClassSessionCard>
  );
}

// Nome + lado, com a etiqueta "convidado" pra quem foi inscrito só pelo nome.
function EnrollmentLabel({
  enrollment,
}: {
  enrollment: AdminEnrollmentSummary;
}) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className="font-medium text-ink">{enrollment.studentName}</span>
      {enrollmentService.isGuest(enrollment) && <GuestBadge />}
      <span className="text-xs text-muted">
        {enrollmentService.sideLabel(enrollment.side)}
      </span>
    </span>
  );
}
