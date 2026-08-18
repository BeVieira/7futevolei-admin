import { useState } from "react";
import { Button, ClassSessionCard } from "@components";
import { PeopleIcon } from "@assets";
import {
  CLASS_LEVELS,
  ClassLevel,
  enrollmentService,
  useDeleteClass,
  useGetClassById,
  useRemoveEnrollmentById,
  useUpdateClass,
} from "@domain";

type Props = {
  sessionId: number;
};

export function AdminClassSessionCard({ sessionId }: Props) {
  const [editing, setEditing] = useState(false);
  const [classLevel, setClassLevel] = useState<ClassLevel>("Iniciante");
  const [capacity, setCapacity] = useState(8);
  const [lockAt, setLockAt] = useState("");

  const { data: detail, isLoading } = useGetClassById(sessionId);

  const updateMutation = useUpdateClass(sessionId);
  const deleteMutation = useDeleteClass(sessionId);
  const removeEnrollmentMutation = useRemoveEnrollmentById(sessionId);

  const busy =
    updateMutation.isPending ||
    deleteMutation.isPending ||
    removeEnrollmentMutation.isPending;

  const error =
    updateMutation.error ??
    deleteMutation.error ??
    removeEnrollmentMutation.error;

  function startEditing() {
    if (!detail) return;
    setClassLevel(detail.classLevel);
    setCapacity(detail.capacity);
    setLockAt(detail.lockAt ?? "");
    setEditing(true);
  }

  if (isLoading || !detail) {
    return (
      <div className="rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
        <p className="text-sm text-slate-400">Carregando...</p>
      </div>
    );
  }

  return (
    <ClassSessionCard
      title={detail.classLevel}
      headerRight={
        <span className="flex items-center gap-1.5 text-sm text-slate-600">
          <PeopleIcon className="h-4 w-4" />
          {detail.confirmedCount}/{detail.capacity}
        </span>
      }
    >
      <p className="text-sm text-slate-500">
        {detail.startTime} - {detail.endTime}
      </p>

      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-3">
            {CLASS_LEVELS.map((option) => (
              <label
                key={option}
                className="flex items-center gap-1.5 text-sm text-slate-700"
              >
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
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div>
            <label
              className="mb-1 block text-xs font-medium text-slate-500"
              htmlFor={`lockAt-${sessionId}`}
            >
              Trancar lista às (opcional)
            </label>
            <input
              id={`lockAt-${sessionId}`}
              type="time"
              value={lockAt}
              onChange={(e) => setLockAt(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
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
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={startEditing}
            className="text-xs font-medium text-teal-500 underline"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => deleteMutation.mutate()}
            disabled={busy}
            className="text-xs font-medium text-red-600 underline"
          >
            Remover
          </button>
        </div>
      )}

      {detail.lockAt && (
        <p
          className={`text-xs font-medium ${detail.isLocked ? "text-red-600" : "text-slate-500"}`}
        >
          {detail.isLocked
            ? `Lista trancada desde as ${detail.lockAt}`
            : `Lista tranca às ${detail.lockAt}`}
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error.message}</p>}

      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-slate-400">
          Confirmados
        </p>
        {detail.confirmed.length === 0 && (
          <p className="text-xs text-slate-400">Ninguém inscrito ainda.</p>
        )}
        <ul className="flex flex-col gap-1">
          {detail.confirmed.map((enrollment) => (
            <li
              key={enrollment.id}
              className="flex items-center justify-between text-sm text-slate-700"
            >
              <span>
                {enrollment.studentName}{" "}
                <span className="text-xs text-slate-400">
                  ({enrollmentService.sideLabel(enrollment.side)})
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeEnrollmentMutation.mutate(enrollment.id)}
                disabled={busy}
                className="text-xs font-medium text-red-600 underline"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      </div>

      {detail.waitlist.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-400">
            Lista de espera
          </p>
          <ul className="flex flex-col gap-1">
            {detail.waitlist.map((enrollment) => (
              <li
                key={enrollment.id}
                className="flex items-center justify-between text-sm text-slate-700"
              >
                <span>
                  {enrollment.studentName}{" "}
                  <span className="text-xs text-slate-400">
                    ({enrollmentService.sideLabel(enrollment.side)})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeEnrollmentMutation.mutate(enrollment.id)}
                  disabled={busy}
                  className="text-xs font-medium text-red-600 underline"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ClassSessionCard>
  );
}
