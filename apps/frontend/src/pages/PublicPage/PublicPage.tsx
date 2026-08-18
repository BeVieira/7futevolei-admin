import { useMemo, useState } from "react";
import { StudentClassSessionCard } from "./components/StudentClassSessionCard";
import { Button, CalendarModal, CollapsibleSectionHeader } from "@components";
import { aulaService, useGetClassesByDate } from "@domain";
import { formatDateLabel, pluralize, toDateInputValue } from "@utils";

export function PublicPage() {
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [collapsedSlots, setCollapsedSlots] = useState<Set<string>>(
    () => new Set(),
  );
  const [calendarOpen, setCalendarOpen] = useState(false);

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
        <p className="mb-1 text-sm font-medium text-slate-600">
          Data das aulas
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => setCalendarOpen(true)}
          className="text-left"
        >
          {formatDateLabel(date)}
        </Button>
      </div>

      {calendarOpen && (
        <CalendarModal
          selectedDate={date}
          onSelect={(selected) => {
            setDate(selected);
            setCalendarOpen(false);
          }}
          onClose={() => setCalendarOpen(false)}
        />
      )}

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
                  <StudentClassSessionCard key={session.id} session={session} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
