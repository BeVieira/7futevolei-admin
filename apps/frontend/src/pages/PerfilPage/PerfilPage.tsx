import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, Button, Card, PushNotificationsControl } from "@components";
import {
  Me,
  Side,
  enrollmentService,
  useGetMe,
  useLogout,
  useUpdateMyName,
  useUpdateMyPreferredSide,
  userService,
} from "@domain";

const SIDES: Side[] = ["LEFT", "RIGHT"];

// Quem chega aqui sem lado preferido (vindo do login ou de "Quero
// participar") traz o destino original em `from`.
type LocationState = { from?: string } | null;

// Rota protegida por `RequireAuth`: aqui sempre há usuário logado.
export function PerfilPage() {
  const { data: me } = useGetMe();
  if (!me) return null;
  return <Perfil me={me} />;
}

function Perfil({ me }: { me: Me }) {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState)?.from;
  const [name, setName] = useState(me.name);
  const [saved, setSaved] = useState(false);
  const updateNameMutation = useUpdateMyName();
  const updateSideMutation = useUpdateMyPreferredSide();
  const logoutMutation = useLogout();

  const nameChanged = name.trim() !== me.name;

  function handleSaveName(e: FormEvent) {
    e.preventDefault();
    if (!userService.isValidName(name) || !nameChanged) return;
    setSaved(false);
    updateNameMutation.mutate(name, {
      onSuccess: updated => {
        setName(updated.name);
        setSaved(true);
      },
    });
  }

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => navigate("/", { replace: true }),
    });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div className="flex items-center gap-4 pb-2">
        <Avatar
          name={me.name}
          photoUrl={me.photoUrl}
          className="h-16 w-16 text-2xl"
        />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-2xl font-bold tracking-tight text-ink">
            {me.name}
          </h1>
          {me.email && (
            <p className="truncate text-sm text-muted">{me.email}</p>
          )}
        </div>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-ink">
            Seu lado na quadra
          </h2>
          <p className="text-sm text-muted">
            {me.preferredSide
              ? "Você é inscrito sempre neste lado. Se marcou errado, é só trocar."
              : "Escolha uma vez: todas as suas inscrições vão ser neste lado."}
          </p>
        </div>
        {/* Os dois lados como as duas metades da quadra. */}
        <div className="grid grid-cols-2 gap-1 rounded-md bg-raised p-1">
          {SIDES.map(side => {
            const selected = me.preferredSide === side;
            return (
              <button
                key={side}
                type="button"
                aria-pressed={selected}
                disabled={updateSideMutation.isPending}
                onClick={() => {
                  if (me.preferredSide !== side) updateSideMutation.mutate(side);
                }}
                className={`min-h-[40px] rounded px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                  selected
                    ? "bg-accent text-white"
                    : "text-muted hover:bg-card hover:text-ink"
                }`}
              >
                {enrollmentService.sideLabel(side)}
              </button>
            );
          })}
        </div>
        {updateSideMutation.isError && (
          <p className="text-sm text-negative">
            {updateSideMutation.error.message}
          </p>
        )}
        {from && me.preferredSide && (
          <Button
            type="button"
            onClick={() => navigate(from, { replace: true })}
          >
            Continuar
          </Button>
        )}
      </Card>

      <Card>
        <form onSubmit={handleSaveName} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="profile-name"
              className="text-base font-semibold text-ink"
            >
              Nome exibido nas listas
            </label>
            <input
              id="profile-name"
              required
              maxLength={userService.MAX_NAME_LENGTH}
              value={name}
              onChange={e => {
                setName(e.target.value);
                setSaved(false);
              }}
              className="field text-base"
            />
          </div>
          {updateNameMutation.isError && (
            <p className="text-sm text-negative">
              {updateNameMutation.error.message}
            </p>
          )}
          {saved && !nameChanged && (
            <p className="text-sm text-positive">Nome atualizado.</p>
          )}
          <Button
            type="submit"
            disabled={
              !nameChanged ||
              !userService.isValidName(name) ||
              updateNameMutation.isPending
            }
            className="sm:self-end"
          >
            {updateNameMutation.isPending ? "Salvando..." : "Salvar nome"}
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-ink">Notificações</h2>
        <PushNotificationsControl />
      </Card>

      {logoutMutation.isError && (
        <p className="text-sm text-negative">{logoutMutation.error.message}</p>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={handleLogout}
        disabled={logoutMutation.isPending}
      >
        {logoutMutation.isPending ? "Saindo..." : "Sair"}
      </Button>
    </div>
  );
}
