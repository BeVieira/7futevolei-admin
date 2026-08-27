import { FormEvent, useState } from "react";
import {
  AdminTabs,
  Button,
  CalendarModal,
  Card,
  CollapsibleSectionHeader,
} from "@components";
import {
  ClassLevel,
  TimeSlotInput,
  aulaService,
  useCreateClassesForDay,
  useGetClassesByDate,
  useGetNextAvailableDate,
} from "@domain";
import {
  buildLockTimeOptions,
  formatDateLabel,
  formatPreviousDayLabel,
  pluralize,
} from "@utils";

import { AdminClassSessionCard } from "./components/AdminClassSessionCard";
import { HorarioBlockEditor } from "./components/HorarioBlockEditor";

export function AdminPage() {
  const { data: nextAvailableDate } = useGetNextAvailableDate();
  const [manualDate, setManualDate] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<TimeSlotInput[]>(() => [
    aulaService.buildDefaultTimeSlot(),
  ]);
  const [collapsedSlots, setCollapsedSlots] = useState<Set<string>>(
    () => new Set(),
  );
  const [formCollapsed, setFormCollapsed] = useState(true);
  const [lockAt, setLockAt] = useState("20:00");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const date = manualDate ?? nextAvailableDate ?? "";

  const { data: sessions = [], isLoading: isLoadingSessions } =
    useGetClassesByDate(date, { enabled: Boolean(date) });
  const isLoading = isLoadingSessions || !date;

  const createDayMutation = useCreateClassesForDay();

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

  function updateBlockStartTime(index: number, value: string) {
    setBlocks((prev) =>
      prev.map((block, i) =>
        i === index ? { ...block, startTime: value } : block,
      ),
    );
  }

  function updateBlockCourts(index: number, count: number) {
    const safeCount = aulaService.clampCourtsCount(count);
    setBlocks((prev) =>
      prev.map((block, i) => {
        if (i !== index) return block;
        const levels = [...block.levels];
        while (levels.length < safeCount) {
          levels.push(aulaService.nextCourtLevel(levels.length));
        }
        levels.length = safeCount;
        return { ...block, levels };
      }),
    );
  }

  function updateBlockLevel(
    blockIndex: number,
    courtIndex: number,
    level: ClassLevel,
  ) {
    setBlocks((prev) =>
      prev.map((block, i) => {
        if (i !== blockIndex) return block;
        const levels = [...block.levels];
        levels[courtIndex] = level;
        return { ...block, levels };
      }),
    );
  }

  function addBlock() {
    setBlocks((prev) => [...prev, aulaService.buildDefaultTimeSlot()]);
  }

  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  }

  function handleCreateDay(e: FormEvent) {
    e.preventDefault();
    createDayMutation.mutate({
      date,
      timeSlots: blocks,
      lockAt: lockAt || undefined,
    });
  }

  const groups = aulaService.groupClassesByTimeSlot(sessions);

  return (
    <div className="flex flex-col gap-8">
      <AdminTabs />

      <div>
        <p className="mb-1 text-sm font-medium text-slate-600">Data</p>
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

      <Card>
        <CollapsibleSectionHeader
          label="Criar dia de aulas"
          collapsed={formCollapsed}
          onToggle={() => setFormCollapsed((v) => !v)}
        />
        {!formCollapsed && (
          <form onSubmit={handleCreateDay} className="mt-4 flex flex-col gap-4">
            <p className="text-sm text-slate-600">
              Criando para{" "}
              <span className="font-medium">{formatDateLabel(date)}</span>
            </p>

            <div>
              <label
                className="mb-1 block text-sm font-medium text-slate-600"
                htmlFor="admin-lock-at"
              >
                Trancar lista às (opcional)
              </label>
              <select
                id="admin-lock-at"
                value={lockAt}
                onChange={(e) => setLockAt(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              >
                <option value="">Não trancar</option>
                {buildLockTimeOptions().map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                A lista tranca no dia anterior ({formatPreviousDayLabel(date)}
                ), no horário escolhido. Após isso, quem já estiver inscrito
                não poderá mais cancelar. Vale para todas as turmas criadas
                neste lote.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {blocks.map((block, index) => (
                <HorarioBlockEditor
                  key={index}
                  index={index}
                  startTime={block.startTime}
                  levels={block.levels}
                  onStartTimeChange={(value) =>
                    updateBlockStartTime(index, value)
                  }
                  onCourtsChange={(count) => updateBlockCourts(index, count)}
                  onLevelChange={(courtIndex, level) =>
                    updateBlockLevel(index, courtIndex, level)
                  }
                  onRemove={() => removeBlock(index)}
                  canRemove={blocks.length > 1}
                />
              ))}
              <Button type="button" variant="secondary" onClick={addBlock}>
                + Adicionar horário
              </Button>
            </div>

            {createDayMutation.isError && (
              <p className="text-sm text-red-600">
                {createDayMutation.error.message}
              </p>
            )}

            <Button type="submit" disabled={createDayMutation.isPending}>
              {createDayMutation.isPending
                ? "Criando..."
                : "Criar dia de aulas"}
            </Button>
          </form>
        )}
      </Card>

      <div className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold text-slate-800">Turmas do dia</h2>
        {isLoading && <p className="text-slate-500">Carregando...</p>}
        {!isLoading && sessions.length === 0 && (
          <p className="text-slate-500">
            Ainda não há turmas cadastradas para esta data.
          </p>
        )}
        {groups.map(([slotKey, slotSessions]) => {
          const totalInscritos = slotSessions.reduce(
            (sum, s) => sum + s.confirmedCount + s.waitlistCount,
            0,
          );
          const isCollapsed = !collapsedSlots.has(slotKey);

          return (
            <section key={slotKey} className="flex flex-col gap-4">
              <CollapsibleSectionHeader
                label={`${slotSessions[0].startTime} - ${slotSessions[0].endTime}`}
                meta={`${pluralize(slotSessions.length, "turma", "turmas")} · ${pluralize(totalInscritos, "inscrito", "inscritos")}`}
                collapsed={isCollapsed}
                onToggle={() => toggleSlot(slotKey)}
              />
              {!isCollapsed && (
                <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-4">
                  {slotSessions.map((session) => (
                    <AdminClassSessionCard
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
