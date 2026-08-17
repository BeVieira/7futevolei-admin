import { useMemo, useState } from "react";
import { CollapsibleSectionHeader } from "../../components";
import { aulaService, useGetClassesByDate } from "../../domain/aula";
import { formatDateLabel, toDateInputValue } from "../../utils/date";
import { pluralize } from "../../utils/format";
import { ClassSessionCard } from "./components/ClassSessionCard";

export function PublicPage() {
  const [date, setDate] = useState(() =>
    toDateInputValue(aulaService.getNextClassDay()),
  );
  const [collapsedSlots, setCollapsedSlots] = useState<Set<string>>(
    () => new Set(),
  );

  const {
    data: sessions = [],
    isLoading,
    isError,
    error,
  } = useGetClassesByDate(date);

  const groups = useMemo(
    () => aulaService.groupClassesByTimeSlot(sessions),
    [sessions],
  );

  function toggleSlot(slotKey: string) {
    setCollapsedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slotKey)) {
        next.delete(slotKey);
      } else {
        next.add(slotKey);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label
          className="mb-1 block text-sm font-medium text-slate-600"
          htmlFor="date"
        >
          Data das aulas
        </label>
        <input
          id="date"
          type="date"
          lang="pt-BR"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
        <p className="mt-1 text-xs text-slate-400">{formatDateLabel(date)}</p>
      </div>

      {isLoading && <p className="text-slate-500">Carregando...</p>}
      {isError && <p className="text-red-600">{error?.message}</p>}
      {!isLoading && !isError && sessions.length === 0 && (
        <p className="text-slate-500">
          Nenhuma turma cadastrada para esta data.
        </p>
      )}

      {groups.map(([slotKey, slotSessions]) => {
        const totalConfirmados = slotSessions.reduce(
          (sum, s) => sum + s.confirmedCount,
          0,
        );
        const totalVagas = slotSessions.reduce((sum, s) => sum + s.capacity, 0);
        const isCollapsed = !collapsedSlots.has(slotKey);

        return (
          <section key={slotKey} className="flex flex-col gap-3">
            <CollapsibleSectionHeader
              label={`${slotSessions[0].startTime} - ${slotSessions[0].endTime}`}
              meta={`${pluralize(slotSessions.length, "turma", "turmas")} · ${totalConfirmados} de ${totalVagas} vagas`}
              collapsed={isCollapsed}
              onToggle={() => toggleSlot(slotKey)}
            />
            {!isCollapsed && (
              <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-3">
                {slotSessions.map((session) => (
                  <ClassSessionCard key={session.id} session={session} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
