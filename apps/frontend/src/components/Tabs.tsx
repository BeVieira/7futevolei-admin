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
    <div className="flex gap-4 border-b border-slate-200 text-sm font-medium">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`flex items-center gap-1.5 pb-2 ${
            active === option.key
              ? "border-b-2 border-teal-500 text-teal-500"
              : "text-slate-500"
          }`}
        >
          {option.label}
          {option.showIndicator && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
          )}
        </button>
      ))}
    </div>
  );
}
