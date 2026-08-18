import { Navigate, Outlet } from "react-router-dom";
import { useGetMe } from "@domain";

export function RequireAdmin() {
  const { data, isLoading, isError } = useGetMe();

  if (isLoading) {
    return <p className="text-slate-500">Carregando...</p>;
  }

  if (isError || !data) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
