type Option<T extends string> = {
  key: T;
  label: string;
  // Bolinha de aviso ao lado do label — pra sinalizar que a aba tem algo
  // que provavelmente exige atenção (ex.: comprovantes pendentes/negados).
  showIndicator?: boolean;
};

type Props<T extends string> = {
  options: Option<T>[];
  active: T;
  onChange: (key: T) => void;
};

export function Tabs<T extends string>({ options, active, onChange }: Props<T>) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-6 border-b border-line text-sm font-medium">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            aria-pressed={active === option.key}
            className={`-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 transition-colors ${
              active === option.key
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {option.label}
            {option.showIndicator && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-negative" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
