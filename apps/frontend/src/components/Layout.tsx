import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useGetMe, useLogout } from "@domain";

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSuccess: isLoggedIn } = useGetMe();
  const logoutMutation = useLogout();

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => navigate("/login"),
    });
  }

  return (
    <div className="min-h-screen bg-background text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
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
            {isLoggedIn && (
              <button
                type="button"
                onClick={handleLogout}
                className="text-slate-500"
              >
                Sair
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
