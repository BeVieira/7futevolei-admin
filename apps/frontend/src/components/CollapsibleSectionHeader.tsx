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
      className="flex w-full items-center justify-between gap-2 border-b border-slate-200 pb-2 text-left"
    >
      <span className="flex items-center gap-2">
        <ChevronIcon
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            collapsed ? "-rotate-90" : ""
          }`}
        />
        <span className="text-base font-semibold text-slate-700">{label}</span>
      </span>
      {meta && (
        <span className="text-xs font-medium text-slate-400">{meta}</span>
      )}
    </button>
  );
}
