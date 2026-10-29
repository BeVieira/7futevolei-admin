import { FormEvent, useEffect, useState } from "react";
import { Avatar, Button } from "@components";
import {
  AdminEnrollee,
  Side,
  UserSearchResult,
  enrollmentService,
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

// Admin inscrevendo alguém: um usuário cadastrado (busca por nome ou e-mail completo),
// que entra no lado do perfil dele, ou um convidado só pelo nome, para quem
// não tem conta — só aí o admin escolhe o lado.
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
      ? selectedUser?.preferredSide
        ? { userId: selectedUser.id }
        : null
      : guestName.trim() && side
        ? { guestName: guestName.trim(), side }
        : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!enrollee) return;
    enrollMutation.mutate(enrollee, { onSuccess: onClose });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md bg-background p-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="option">
          <input
            type="radio"
            name={`enroll-mode-${sessionId}`}
            checked={mode === "user"}
            onChange={() => setMode("user")}
          />
          Aluno cadastrado
        </label>
        <label className="option">
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
          <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-card px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
              <Avatar
                name={selectedUser.name}
                photoUrl={selectedUser.photoUrl}
                className="h-6 w-6 text-xs"
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{selectedUser.name}</span>
                {selectedUser.preferredSide ? (
                  <span className="text-xs text-muted">
                    Lado{" "}
                    {enrollmentService
                      .sideLabel(selectedUser.preferredSide)
                      .toLowerCase()}
                  </span>
                ) : (
                  <span className="text-xs text-negative">
                    Ainda não escolheu o lado no perfil — peça pra escolher
                    antes de inscrever.
                  </span>
                )}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="text-action shrink-0 text-ink"
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
              placeholder="Buscar por nome ou e-mail completo"
              aria-label="Buscar aluno"
              className="field"
            />
            {searchFailed && (
              <p className="text-xs text-negative">{searchError.message}</p>
            )}
            {search.trim().length >= 2 &&
              !searching &&
              !searchFailed &&
              results.length === 0 && (
                <p className="text-xs text-muted">
                  Ninguém encontrado. Quem ainda não tem conta pode entrar como
                  convidado.
                </p>
              )}
            {results.length > 0 && (
              <ul className="flex max-h-48 flex-col divide-y divide-rule overflow-y-auto rounded-md border border-line bg-card">
                {results.map(user => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(user)}
                      className="flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-background"
                    >
                      <Avatar
                        name={user.name}
                        photoUrl={user.photoUrl}
                        className="h-6 w-6 text-xs"
                      />
                      <span className="truncate text-ink">
                        {user.name}
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
          aria-label="Nome do convidado"
          className="field"
        />
      )}

      {mode === "guest" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="option num">
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
          <label className="option num">
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
      )}

      {enrollMutation.isError && (
        <p className="text-sm text-negative">{enrollMutation.error.message}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={!enrollee || enrollMutation.isPending}>
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
