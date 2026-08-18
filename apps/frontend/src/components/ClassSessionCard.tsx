import { ReactNode, useState } from "react";
import { Card } from "./Card";
import { ChevronIcon } from "../assets/icons";

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

  return (
    <Card className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          className="flex items-center gap-1.5 text-left"
        >
          <ChevronIcon
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
              collapsed ? "-rotate-90" : ""
            }`}
          />
          <span className="font-semibold text-slate-800">{title}</span>
        </button>
        {headerRight && (
          <span className="flex items-center gap-2">{headerRight}</span>
        )}
      </div>

      {!collapsed && children}
    </Card>
  );
}
