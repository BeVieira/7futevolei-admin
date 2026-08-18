import { Link, Outlet, useLocation } from "react-router-dom";

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="text-lg font-bold text-teal-500">7Futevôlei</span>
          <nav className="flex gap-4 text-sm font-medium">
            <Link
              to="/"
              className={
                location.pathname === "/" ? "text-teal-500" : "text-slate-500"
              }
            >
              Aulas
            </Link>
            <Link
              to="/minhas-aulas"
              className={
                location.pathname === "/minhas-aulas"
                  ? "text-teal-500"
                  : "text-slate-500"
              }
            >
              Minhas aulas
            </Link>
            <Link
              to="/admin"
              className={
                location.pathname.startsWith("/admin")
                  ? "text-teal-500"
                  : "text-slate-500"
              }
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
