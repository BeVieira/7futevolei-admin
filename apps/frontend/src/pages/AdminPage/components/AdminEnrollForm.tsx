import { FormEvent, useEffect, useState } from "react";
import { Avatar, Button } from "@components";
import {
  AdminEnrollee,
  Side,
  UserSearchResult,
  useAdminEnrollStudent,
  useSearchUsers,
} from "@domain";

type Props = {
  sessionId: number;
  sideCapacity: number;
  leftCount: number;
  rightCount: number;
  onClose: () => void;
};

type Mode = "user" | "guest";

// Espera o admin parar de digitar antes de buscar, pra não disparar uma
// busca por tecla.
const SEARCH_DEBOUNCE_MS = 300;

// Admin inscrevendo alguém: um usuário cadastrado (busca por nome/e-mail) ou
// um convidado só pelo nome, para quem não tem conta.
export function AdminEnrollForm({
  sessionId,
  sideCapacity,
  leftCount,
  rightCount,
  onClose,
}: Props) {
  const [mode, setMode] = useState<Mode>("user");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(
    null,
  );
  const [guestName, setGuestName] = useState("");
  const [side, setSide] = useState<Side | "">("");

  const enrollMutation = useAdminEnrollStudent(sessionId);
  const {
    data: results = [],
    isFetching: searching,
    isError: searchFailed,
    error: searchError,
  } = useSearchUsers(search);

  useEffect(() => {
    const timeout = setTimeout(
      () => setSearch(searchInput),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const enrollee: AdminEnrollee | null =
    mode === "user"
      ? selectedUser && { userId: selectedUser.id }
      : guestName.trim()
        ? { guestName: guestName.trim() }
        : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!enrollee || !side) return;
    enrollMutation.mutate({ enrollee, side }, { onSuccess: onClose });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5 text-slate-700">
          <input
            type="radio"
            name={`enroll-mode-${sessionId}`}
            checked={mode === "user"}
            onChange={() => setMode("user")}
          />
          Aluno cadastrado
        </label>
        <label className="flex items-center gap-1.5 text-slate-700">
          <input
            type="radio"
            name={`enroll-mode-${sessionId}`}
            checked={mode === "guest"}
            onChange={() => setMode("guest")}
          />
          Convidado
        </label>
      </div>

      {mode === "user" ? (
        selectedUser ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-sm text-slate-800">
              <Avatar
                name={selectedUser.name}
                photoUrl={selectedUser.photoUrl}
                className="h-6 w-6 text-xs"
              />
              <span className="truncate">{selectedUser.name}</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="text-xs font-medium text-teal-500 underline"
            >
              Trocar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <input
              autoFocus
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {searchFailed && (
              <p className="text-xs text-red-600">{searchError.message}</p>
            )}
            {search.trim().length >= 2 &&
              !searching &&
              !searchFailed &&
              results.length === 0 && (
                <p className="text-xs text-slate-400">
                  Ninguém encontrado. Quem ainda não tem conta pode entrar como
                  convidado.
                </p>
              )}
            {results.length > 0 && (
              <ul className="flex max-h-48 flex-col overflow-y-auto rounded-lg border border-slate-200">
                {results.map(user => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(user)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-background"
                    >
                      <Avatar
                        name={user.name}
                        photoUrl={user.photoUrl}
                        className="h-6 w-6 text-xs"
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-slate-800">
                          {user.name}
                        </span>
                        <span className="truncate text-xs text-slate-400">
                          {user.email}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      ) : (
        <input
          autoFocus
          required
          maxLength={100}
          value={guestName}
          onChange={e => setGuestName(e.target.value)}
          placeholder="Nome do convidado"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      )}

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-1.5 text-sm text-slate-700">
          <input
            type="radio"
            name={`add-side-${sessionId}`}
            value="LEFT"
            required
            checked={side === "LEFT"}
            onChange={() => setSide("LEFT")}
          />
          Esquerda ({leftCount}/{sideCapacity}
          {leftCount >= sideCapacity ? " — lista de espera" : ""})
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-700">
          <input
            type="radio"
            name={`add-side-${sessionId}`}
            value="RIGHT"
            required
            checked={side === "RIGHT"}
            onChange={() => setSide("RIGHT")}
          />
          Direita ({rightCount}/{sideCapacity}
          {rightCount >= sideCapacity ? " — lista de espera" : ""})
        </label>
      </div>

      {enrollMutation.isError && (
        <p className="text-xs text-red-600">{enrollMutation.error.message}</p>
      )}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={!enrollee || !side || enrollMutation.isPending}
        >
          Inscrever
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={enrollMutation.isPending}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
