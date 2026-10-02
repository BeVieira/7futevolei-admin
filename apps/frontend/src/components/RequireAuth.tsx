import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useGetMe } from "@domain";

// Rotas que exigem login (minhas aulas, perfil). Sem sessão, manda pro
// login levando o caminho atual em `state.from` — a LoginPage guarda e
// volta pra cá depois.
export function RequireAuth() {
  const location = useLocation();
  const { data: me, isLoading, isError, error } = useGetMe();

  if (isLoading) {
    return <p className="text-slate-500">Carregando...</p>;
  }

  if (isError) {
    return <p className="text-red-600">{error.message}</p>;
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

  return <Outlet />;
}
