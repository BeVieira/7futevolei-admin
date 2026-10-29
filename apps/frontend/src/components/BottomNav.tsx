import { Link, useLocation } from "react-router-dom";
import { CalendarIcon, DollarIcon } from "@assets";

const TABS = [
  { to: "/", label: "Aulas", Icon: CalendarIcon, isActive: (p: string) => p === "/" },
  {
    to: "/minhas-aulas",
    label: "Comprovante",
    Icon: DollarIcon,
    isActive: (p: string) => p === "/minhas-aulas",
  },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-[1440px]">
        {TABS.map(({ to, label, Icon, isActive }) => {
          const active = isActive(location.pathname);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-xs ${
                active ? "font-semibold text-ink" : "font-medium text-muted"
              }`}
            >
              <span
                className={`flex h-7 w-14 items-center justify-center rounded-full transition-colors ${
                  active ? "bg-accent-soft text-accent" : ""
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
