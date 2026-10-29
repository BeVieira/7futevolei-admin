import { Link, Outlet, useLocation } from "react-router-dom";
import {
  authService,
  useClearSessionOnExpiry,
  useGetMe,
  useSyncPushSubscription,
} from "@domain";
import { Avatar } from "./Avatar";
import { BottomNav } from "./BottomNav";

// Link do cabeçalho: ativo ganha o fundo claro da marca.
function headerLinkClass(active: boolean): string {
  return `rounded-md px-2.5 py-1.5 transition-colors ${
    active
      ? "bg-accent-soft text-accent-ink"
      : "text-muted hover:text-ink"
  }`;
}

export function Layout() {
  const location = useLocation();
  const { data: me, isLoading } = useGetMe();
  useClearSessionOnExpiry();

  // Reatribui a inscrição de push deste aparelho a quem está logado (só
  // chama o backend quando a conta muda — ver domain/push).
  useSyncPushSubscription(me?.id);

  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-card">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/favicon-64x64.png"
              alt=""
              className="h-7 w-7 rounded-full"
            />
            <span className="text-base font-semibold tracking-tight text-ink">
              7Futevôlei
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm font-medium">
            {authService.isAdmin(me) && (
              <Link
                to="/admin"
                className={headerLinkClass(
                  location.pathname.startsWith("/admin"),
                )}
              >
                Admin
              </Link>
            )}
            {/* Enquanto a sessão carrega, nem "Entrar" nem avatar — evita
                piscar "Entrar" pra quem já está logado. */}
            {!isLoading &&
              (me ? (
                <Link
                  to="/perfil"
                  aria-label="Meu perfil"
                  className={`rounded-full p-0.5 ${
                    location.pathname === "/perfil"
                      ? "ring-2 ring-accent-mark"
                      : ""
                  }`}
                >
                  <Avatar name={me.name} photoUrl={me.photoUrl} />
                </Link>
              ) : (
                <Link
                  to="/login"
                  state={{ from: location.pathname + location.search }}
                  className={headerLinkClass(location.pathname === "/login")}
                >
                  Entrar
                </Link>
              ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 pb-28 sm:px-6 pt-6 sm:pt-8">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
