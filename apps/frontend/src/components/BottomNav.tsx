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
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-card">
      <div className="mx-auto flex max-w-7xl divide-x divide-slate-200">
        {TABS.map(({ to, label, Icon, isActive }) => {
          const active = isActive(location.pathname);
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium ${
                active ? "text-teal-500" : "text-slate-500"
              }`}
            >
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
