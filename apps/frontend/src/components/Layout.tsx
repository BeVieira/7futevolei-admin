import { Link, Outlet, useLocation } from "react-router-dom";
import { authService, useClearSessionOnExpiry, useGetMe } from "@domain";
import { Avatar } from "./Avatar";
import { BottomNav } from "./BottomNav";

export function Layout() {
  const location = useLocation();
  const { data: me, isLoading } = useGetMe();
  useClearSessionOnExpiry();

  // integração (Dev 2): useSyncPushSubscription(me?.id) — reatribui a
  // inscrição de push deste aparelho a quem está logado.

  return (
    <div className="min-h-screen bg-background text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-bold text-teal-500">
            7Futevôlei
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            {authService.isAdmin(me) && (
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
            )}
            {/* Enquanto a sessão carrega, nem "Entrar" nem avatar — evita
                piscar "Entrar" pra quem já está logado. */}
            {!isLoading &&
              (me ? (
                <Link to="/perfil" aria-label="Meu perfil">
                  <Avatar name={me.name} photoUrl={me.photoUrl} />
                </Link>
              ) : (
                <Link
                  to="/login"
                  state={{ from: location.pathname + location.search }}
                  className={
                    location.pathname === "/login"
                      ? "text-teal-500"
                      : "text-slate-500"
                  }
                >
                  Entrar
                </Link>
              ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
