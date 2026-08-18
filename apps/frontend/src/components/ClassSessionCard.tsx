import { KeyboardEvent, MouseEvent, ReactNode, useState } from "react";
import { Card } from "./Card";
import { ChevronIcon } from "@assets";

type Props = {
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
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

  return (
    <Card className={`flex flex-col gap-3 ${className}`}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={handleHeaderClick}
        onKeyDown={handleHeaderKeyDown}
        className="flex cursor-pointer items-center justify-between gap-2"
      >
        <span className="flex items-center gap-1.5">
          <ChevronIcon
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
              collapsed ? "-rotate-90" : ""
            }`}
          />
          <span className="font-semibold text-slate-800">{title}</span>
        </span>
        {headerRight && (
          <span className="flex items-center gap-2">{headerRight}</span>
        )}
      </div>

      {!collapsed && children}
    </Card>
  );
}
