import { Link, useLocation } from "react-router-dom";

const TABS = [
  { to: "/admin", label: "Turmas" },
  { to: "/admin/cobranca", label: "Cobrança" },
];

export function AdminTabs() {
  const location = useLocation();

  return (
    <div className="flex gap-6 border-b border-line text-sm font-medium">
      {TABS.map(({ to, label }) => {
        const active = location.pathname === to;
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2.5 transition-colors ${
              active
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
