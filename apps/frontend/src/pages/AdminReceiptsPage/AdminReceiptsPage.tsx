import { useState } from "react";
import {
  AdminTabs,
  Button,
  CalendarModal,
  CollapsibleSectionHeader,
} from "@components";
import { aulaService, useGetClassesByDate } from "@domain";
import { formatDateLabel, pluralize, toDateInputValue } from "@utils";

import { ReceiptReviewCard } from "./components/ReceiptReviewCard";

export function AdminReceiptsPage() {
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [collapsedSlots, setCollapsedSlots] = useState<Set<string>>(
    () => new Set(),
  );

  const { data: sessions = [], isLoading } = useGetClassesByDate(date);
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
    <div className="flex flex-col gap-8">
      <AdminTabs />

      <div>
        <p className="mb-1 text-sm font-medium text-slate-600">Data</p>
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

      <div className="flex flex-col gap-6">
        {isLoading && <p className="text-slate-500">Carregando...</p>}
        {!isLoading && sessions.length === 0 && (
          <p className="text-slate-500">
            Nenhuma turma cadastrada para esta data.
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
