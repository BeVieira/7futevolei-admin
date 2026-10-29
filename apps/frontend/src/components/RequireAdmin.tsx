import { Navigate, Outlet, useLocation } from "react-router-dom";
import { authService, useGetMe } from "@domain";

// Rotas do admin: sem sessão vai pro login (e volta depois); logado como
// aluno vai pra tela inicial — o backend responderia 403 de qualquer jeito.
export function RequireAdmin() {
  const location = useLocation();
  const { data: me, isLoading, isError, error } = useGetMe();

  if (isLoading) {
    return <p className="text-muted">Carregando...</p>;
  }

  if (isError) {
    return <p className="text-negative">{error.message}</p>;
  }

  if (!me) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (!authService.isAdmin(me)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
