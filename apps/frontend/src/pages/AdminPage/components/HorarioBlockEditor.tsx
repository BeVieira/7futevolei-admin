import { useEffect, useState } from "react";
import { aulaService, CLASS_LEVELS, ClassLevel } from "../../../domain/aula";

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
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-600">
          Horário {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-medium text-red-600 underline"
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
          onChange={(e) => onStartTimeChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
        <span className="whitespace-nowrap text-sm text-slate-400">
          até {aulaService.addOneHour(startTime)}
        </span>
      </div>

      <div>
        <label
          className="mb-1 block text-sm font-medium text-slate-600"
          htmlFor={`courts-${index}`}
        >
          Quantidade de quadras
        </label>
        <input
          id={`courts-${index}`}
          type="number"
          min={1}
          max={3}
          value={courtsText}
          onChange={(e) => handleCourtsChange(e.target.value)}
          onBlur={handleCourtsBlur}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-3">
        {levels.map((level, courtIndex) => (
          <div key={courtIndex}>
            <p className="mb-1 text-xs font-medium text-slate-500">
              Quadra {courtIndex + 1}
            </p>
            <div className="flex flex-wrap gap-3">
              {CLASS_LEVELS.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-1.5 text-sm text-slate-700"
                >
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
