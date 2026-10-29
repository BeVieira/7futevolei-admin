import { useMemo, useState } from "react";
import { Modal } from "./Modal";
import { ChevronIcon } from "@assets";
import { useGetClassDatesByMonth } from "@domain";
import { toDateInputValue, toMonthInputValue } from "@utils";

type Props = {
  selectedDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
};

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

function buildMonthWeeks(viewDate: Date): (string | null)[][] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();

  const cells: (string | null)[] = Array(startWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toDateInputValue(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function CalendarModal({ selectedDate, onSelect, onClose }: Props) {
  const [viewDate, setViewDate] = useState(
    () => new Date(`${selectedDate}T00:00:00`),
  );

  const month = toMonthInputValue(viewDate);
  const { data: datesWithClasses = [] } = useGetClassDatesByMonth(month);
  const datesWithClassesSet = useMemo(
    () => new Set(datesWithClasses),
    [datesWithClasses],
  );

  const weeks = useMemo(() => buildMonthWeeks(viewDate), [viewDate]);
  const monthLabel = viewDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const today = toDateInputValue(new Date());

  function goToPreviousMonth() {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  return (
    <Modal title="Selecionar data" onClose={onClose}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goToPreviousMonth}
          aria-label="Mês anterior"
          className="rounded-md p-2 hover:bg-raised"
        >
          <ChevronIcon className="h-4 w-4 rotate-90 text-muted" />
        </button>
        <span className="text-base font-semibold capitalize text-ink">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={goToNextMonth}
          aria-label="Próximo mês"
          className="rounded-md p-2 hover:bg-raised"
        >
          <ChevronIcon className="h-4 w-4 -rotate-90 text-muted" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {weeks.flatMap((week, weekIndex) =>
          week.map((dateStr, dayIndex) => {
            if (!dateStr) {
              return <div key={`${weekIndex}-${dayIndex}`} className="h-11" />;
            }

            const day = Number(dateStr.slice(-2));
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === today;
            const hasClasses = datesWithClassesSet.has(dateStr);

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => onSelect(dateStr)}
                className={`num flex h-11 flex-col items-center justify-center gap-0.5 rounded-md text-sm transition-colors ${
                  isSelected
                    ? "bg-accent font-semibold text-white"
                    : isToday
                      ? "bg-accent-soft font-semibold text-accent-ink"
                      : "text-ink hover:bg-raised"
                }`}
              >
                {day}
                <span
                  className={`h-1 w-1 rounded-full ${
                    hasClasses
                      ? isSelected
                        ? "bg-white"
                        : "bg-accent-mark"
                      : "bg-transparent"
                  }`}
                />
              </button>
            );
          }),
        )}
      </div>
    </Modal>
  );
}
