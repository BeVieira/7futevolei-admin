import { CalendarIcon, ChevronIcon } from "@assets";
import { formatDateLabel } from "@utils";

type Props = {
  // Data no formato do `<input type="date">`; vazia enquanto carrega.
  date: string;
  onClick: () => void;
};

// Botão que mostra a data escolhida e abre o `CalendarModal`.
export function DatePickerButton({ date, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!date}
      aria-haspopup="dialog"
      aria-label={date ? `Data: ${formatDateLabel(date)}. Trocar data` : "Carregando data"}
      className="inline-flex min-h-[40px] w-full items-center gap-2 rounded-md border border-control bg-card px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-background disabled:cursor-not-allowed disabled:text-muted sm:w-auto"
    >
      <CalendarIcon className="h-4 w-4 shrink-0 text-accent" />
      <span className="num flex-1">
        {date ? formatDateLabel(date) : "Carregando..."}
      </span>
      <ChevronIcon className="h-4 w-4 shrink-0 text-muted" />
    </button>
  );
}
