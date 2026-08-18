import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card } from "@components";
import { useLogin } from "@domain";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const loginMutation = useLogin();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    loginMutation.mutate(
      { username, password },
      { onSuccess: () => navigate("/admin") },
    );
  }

  return (
    <div className="flex justify-center">
      <Card className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-lg font-semibold text-slate-800">
          Login administrativo
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label
              className="mb-1 block text-sm font-medium text-slate-600"
              htmlFor="username"
            >
              Usuário
            </label>
            <input
              id="username"
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-slate-600"
              htmlFor="password"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            />
          </div>
          {loginMutation.isError && (
            <p className="text-sm text-red-600">
              {loginMutation.error.message}
            </p>
          )}
          <Button type="submit" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
