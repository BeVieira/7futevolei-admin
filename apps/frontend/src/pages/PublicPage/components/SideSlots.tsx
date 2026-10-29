type Props = {
  label: string;
  names: (string | null)[];
};

// Uma metade da quadra: o lado, a lotação dele e uma linha por vaga.
export function SideSlots({ label, names }: Props) {
  const filled = names.filter(Boolean).length;
  return (
    <div className="flex min-w-0 flex-col gap-1.5 p-2.5">
      <p className="flex items-baseline justify-between gap-2 px-0.5 text-xs">
        <span className="font-semibold text-accent-ink">{label}</span>
        <span className="num text-muted">
          {filled}/{names.length}
        </span>
      </p>
      <div className="flex flex-col gap-1.5">
        {names.map((studentName, i) =>
          studentName ? (
            <div
              key={i}
              className="break-words rounded bg-card px-2.5 py-1.5 text-sm font-medium leading-snug text-ink"
            >
              {studentName}
            </div>
          ) : (
            <div
              key={i}
              className="rounded border border-dashed border-accent-light px-2.5 py-1.5 text-sm leading-snug text-muted"
            >
              vaga livre
            </div>
          ),
        )}
      </div>
    </div>
  );
}
