import { ChevronIcon } from "@assets";

type Props = {
  label: string;
  meta?: string;
  collapsed: boolean;
  onToggle: () => void;
};

export function CollapsibleSectionHeader({
  label,
  meta,
  collapsed,
  onToggle,
}: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="flex min-h-[44px] w-full items-center justify-between gap-3 border-b border-line pb-2 text-left"
    >
      <span className="flex items-center gap-2">
        <ChevronIcon
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${
            collapsed ? "-rotate-90" : ""
          }`}
        />
        <span className="num text-lg font-semibold tracking-tight text-ink">
          {label}
        </span>
      </span>
      {meta && (
        <span className="num text-right text-[13px] text-muted">{meta}</span>
      )}
    </button>
  );
}
