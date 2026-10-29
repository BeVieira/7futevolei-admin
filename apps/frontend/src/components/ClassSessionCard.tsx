import { KeyboardEvent, MouseEvent, ReactNode, useState } from "react";
import { Card } from "./Card";
import { ChevronIcon } from "@assets";

type Props = {
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  // Lotação da turma: desenha uma barra fina na proporção real sob o
  // cabeçalho, visível mesmo com o card recolhido.
  occupancy?: { filled: number; total: number };
  // Sem `collapsed`/`onToggle`: o card controla seu próprio estado (caso da
  // maioria das telas). Passe os dois quando a tela precisar expandir o
  // card de fora (ex.: ao entrar na lista de espera pelo modal).
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onToggle?: () => void;
};

export function ClassSessionCard({
  title,
  headerRight,
  children,
  className = "",
  occupancy,
  collapsed: collapsedProp,
  defaultCollapsed = true,
  onToggle,
}: Props) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const collapsed = collapsedProp ?? internalCollapsed;

  function toggle() {
    if (onToggle) {
      onToggle();
    } else {
      setInternalCollapsed((v) => !v);
    }
  }

  // O cabeçalho inteiro expande/recolhe ao clicar, exceto em botões vindos
  // de dentro de `headerRight` (ex.: abrir a lista de espera) — esses só
  // disparam a própria ação. Por isso o cabeçalho é um `div` com
  // role="button", não um `<button>` de fato: um `<button>` não pode conter
  // outro `<button>` (HTML inválido), e `headerRight` as vezes tem um.
  function handleHeaderClick(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    toggle();
  }

  function handleHeaderKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  }

  const occupancyRatio =
    occupancy && occupancy.total > 0
      ? Math.min(occupancy.filled / occupancy.total, 1)
      : 0;

  return (
    <Card className={`flex flex-col gap-4 ${className}`}>
      <div className="flex flex-col gap-2.5">
        <div
          role="button"
          tabIndex={0}
          aria-expanded={!collapsed}
          onClick={handleHeaderClick}
          onKeyDown={handleHeaderKeyDown}
          className="-m-1 flex cursor-pointer flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-md p-1"
        >
          {/* O nome nunca é cortado: sem espaço, o `headerRight` desce
              pra linha de baixo em vez de sobrepor ou truncar o nome. */}
          <span className="flex items-center gap-1.5">
            <ChevronIcon
              className={`h-4 w-4 shrink-0 text-muted transition-transform ${
                collapsed ? "-rotate-90" : ""
              }`}
            />
            <span className="whitespace-nowrap text-base font-semibold text-ink">
              {title}
            </span>
          </span>
          {headerRight && (
            <span className="ml-auto flex shrink-0 items-center gap-2">
              {headerRight}
            </span>
          )}
        </div>
        {occupancy && (
          <div
            className="h-1 overflow-hidden rounded-full bg-accent-track"
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full bg-accent-mark"
              style={{ width: `${occupancyRatio * 100}%` }}
            />
          </div>
        )}
      </div>

      {!collapsed && children}
    </Card>
  );
}
