import { useMemo, useState } from "react";
import { StudentClassSessionCard } from "./components/StudentClassSessionCard";
import { Button, CalendarModal, CollapsibleSectionHeader } from "@components";
import {
  aulaService,
  useGetClassesByDate,
  useGetNextAvailableDate,
} from "@domain";
import { formatDateLabel, pluralize } from "@utils";

export function PublicPage() {
  const { data: nextAvailableDate } = useGetNextAvailableDate();
  const [manualDate, setManualDate] = useState<string | null>(null);
  const [collapsedSlots, setCollapsedSlots] = useState<Set<string>>(
    () => new Set(),
  );
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Enquanto a próxima data com aulas ainda não chegou, não escolhemos "hoje"
  // como padrão — senão o usuário vê a tela vazia de "hoje" piscar antes de
  // corrigir pra data certa.
  const date = manualDate ?? nextAvailableDate ?? "";

  const {
    data: sessions = [],
    isLoading: isLoadingSessions,
    isError,
    error,
  } = useGetClassesByDate(date, { enabled: Boolean(date) });

  const isLoading = isLoadingSessions || !date;

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
          disabled={!date}
          className="text-left"
        >
          {date ? formatDateLabel(date) : "Carregando..."}
        </Button>
      </div>

      {calendarOpen && date && (
        <CalendarModal
          selectedDate={date}
          onSelect={(selected) => {
            setManualDate(selected);
            setCalendarOpen(false);
          }}
          onClose={() => setCalendarOpen(false)}
        />
      )}

      {isLoading && <p className="text-slate-500">Carregando...</p>}
      {isError && <p className="text-red-600">{error?.message}</p>}
      {!isLoading && !isError && sessions.length === 0 && (
        <p className="text-slate-500">
          Ainda não há turmas cadastradas para esta data.
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
