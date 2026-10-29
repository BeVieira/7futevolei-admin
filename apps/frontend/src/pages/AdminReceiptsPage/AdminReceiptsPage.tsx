import { useState } from "react";
import {
  AdminTabs,
  CalendarModal,
  CollapsibleSectionHeader,
  DatePickerButton,
} from "@components";
import {
  aulaService,
  useGetClassesByDate,
  useGetNextAvailableDate,
} from "@domain";
import { pluralize } from "@utils";

import { ReceiptReviewCard } from "./components/ReceiptReviewCard";

export function AdminReceiptsPage() {
  const { data: nextAvailableDate } = useGetNextAvailableDate();
  const [manualDate, setManualDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [collapsedSlots, setCollapsedSlots] = useState<Set<string>>(
    () => new Set(),
  );

  const date = manualDate ?? nextAvailableDate ?? "";

  const { data: sessions = [], isLoading: isLoadingSessions } =
    useGetClassesByDate(date, { enabled: Boolean(date) });
  const isLoading = isLoadingSessions || !date;
  const groups = aulaService.groupClassesByTimeSlot(sessions);

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
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[32px]">
          Admin
        </h1>
        <AdminTabs />
      </div>

      <DatePickerButton date={date} onClick={() => setCalendarOpen(true)} />

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

      <div className="flex flex-col gap-6">
        {isLoading && <p className="text-sm text-muted">Carregando...</p>}
        {!isLoading && sessions.length === 0 && (
          <p className="rounded-lg border border-dashed border-control px-4 py-6 text-center text-sm text-muted">
            Ainda não há turmas cadastradas para esta data.
          </p>
        )}
        {groups.map(([slotKey, slotSessions]) => {
          const isCollapsed = !collapsedSlots.has(slotKey);

          return (
            <section key={slotKey} className="flex flex-col gap-3">
              <CollapsibleSectionHeader
                label={`${slotSessions[0].startTime} - ${slotSessions[0].endTime}`}
                meta={pluralize(slotSessions.length, "turma", "turmas")}
                collapsed={isCollapsed}
                onToggle={() => toggleSlot(slotKey)}
              />
              {!isCollapsed && (
                <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {slotSessions.map((session) => (
                    <ReceiptReviewCard
                      key={session.id}
                      sessionId={session.id}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
