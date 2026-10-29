import { useEffect, useState } from "react";
import { CLASS_LEVELS, ClassLevel } from "@domain";
import { addOneHour } from "@utils";

type Props = {
  index: number;
  startTime: string;
  levels: ClassLevel[];
  onStartTimeChange: (value: string) => void;
  onCourtsChange: (count: number) => void;
  onLevelChange: (courtIndex: number, level: ClassLevel) => void;
  onRemove: () => void;
  canRemove: boolean;
};

export function HorarioBlockEditor({
  index,
  startTime,
  levels,
  onStartTimeChange,
  onCourtsChange,
  onLevelChange,
  onRemove,
  canRemove,
}: Props) {
  const [courtsText, setCourtsText] = useState(String(levels.length));

  useEffect(() => {
    setCourtsText(String(levels.length));
  }, [levels.length]);

  function handleCourtsChange(raw: string) {
    setCourtsText(raw);
    const parsed = Number(raw);
    if (raw !== "" && Number.isInteger(parsed) && parsed >= 1) {
      onCourtsChange(parsed);
    }
  }

  function handleCourtsBlur() {
    setCourtsText(String(levels.length));
  }

  return (
    <div className="flex flex-col gap-4 rounded-md bg-background p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">
          Horário {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-action text-negative"
          >
            Remover horário
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="time"
          required
          value={startTime}
          onChange={e => onStartTimeChange(e.target.value)}
          aria-label="Início do horário"
          className="field text-base"
        />
        <span className="num whitespace-nowrap text-sm text-muted">
          até {addOneHour(startTime)}
        </span>
      </div>

      <div>
        <label
          className="mb-2 block text-sm font-medium text-ink"
          htmlFor={`courts-${index}`}
        >
          Quantidade de quadras
        </label>
        <input
          id={`courts-${index}`}
          type="number"
          // Teclado só de números no celular (`pattern` é o que faz o iOS
          // abrir o teclado numérico; `inputMode`, o Android).
          inputMode="numeric"
          pattern="[0-9]*"
          min={1}
          max={4}
          value={courtsText}
          onChange={e => handleCourtsChange(e.target.value)}
          onBlur={handleCourtsBlur}
          className="field text-base"
        />
      </div>

      <div className="flex flex-col gap-3">
        {levels.map((level, courtIndex) => (
          <div key={courtIndex}>
            <p className="mb-2 text-sm font-medium text-ink">
              Quadra {courtIndex + 1}
            </p>
            <div className="flex flex-wrap gap-2">
              {CLASS_LEVELS.map(option => (
                <label key={option} className="option">
                  <input
                    type="radio"
                    name={`horario-${index}-quadra-${courtIndex}`}
                    value={option}
                    checked={level === option}
                    onChange={() => onLevelChange(courtIndex, option)}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
