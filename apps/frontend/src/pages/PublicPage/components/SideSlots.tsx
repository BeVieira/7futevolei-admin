type Props = {
  label: string;
  names: (string | null)[];
};

export function SideSlots({ label, names }: Props) {
  const filled = names.filter(Boolean).length;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label} · {filled}/{names.length}
      </p>
      <div className="flex flex-col gap-1.5">
        {names.map((studentName, i) =>
          studentName ? (
            <div
              key={i}
              className="rounded-xl bg-background px-3 py-2 text-sm font-medium text-slate-800"
            >
              {studentName}
            </div>
          ) : (
            <div
              key={i}
              className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-400"
            >
              vaga livre
            </div>
          ),
        )}
      </div>
    </div>
  );
}
