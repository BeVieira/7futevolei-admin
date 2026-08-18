import { Link, useLocation } from "react-router-dom";

export function AdminTabs() {
  const location = useLocation();

  return (
    <div className="flex gap-4 border-b border-slate-200 text-sm font-medium">
      <Link
        to="/admin"
        className={`pb-2 ${
          location.pathname === "/admin"
            ? "border-b-2 border-teal-500 text-teal-500"
            : "text-slate-500"
        }`}
      >
        Turmas
      </Link>
      <Link
        to="/admin/cobranca"
        className={`pb-2 ${
          location.pathname === "/admin/cobranca"
            ? "border-b-2 border-teal-500 text-teal-500"
            : "text-slate-500"
        }`}
      >
        Cobrança
      </Link>
    </div>
  );
}
