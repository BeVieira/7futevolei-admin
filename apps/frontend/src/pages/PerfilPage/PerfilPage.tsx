import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Button, Card, PushNotificationsControl } from "@components";
import { Me, useGetMe, useLogout, useUpdateMyName, userService } from "@domain";

// Rota protegida por `RequireAuth`: aqui sempre há usuário logado.
export function PerfilPage() {
  const { data: me } = useGetMe();
  if (!me) return null;
  return <Perfil me={me} />;
}

function Perfil({ me }: { me: Me }) {
  const navigate = useNavigate();
  const [name, setName] = useState(me.name);
  const [saved, setSaved] = useState(false);
  const updateNameMutation = useUpdateMyName();
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
      <Card className="flex flex-col items-center gap-3">
        <Avatar
          name={me.name}
          photoUrl={me.photoUrl}
          className="h-20 w-20 text-2xl"
        />
        <p className="text-sm text-slate-500">{me.email}</p>
      </Card>

      <Card>
        <form onSubmit={handleSaveName} className="flex flex-col gap-2">
          <label
            htmlFor="profile-name"
            className="text-sm font-medium text-slate-600"
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
          {updateNameMutation.isError && (
            <p className="text-sm text-red-600">
              {updateNameMutation.error.message}
            </p>
          )}
          {saved && !nameChanged && (
            <p className="text-sm text-teal-600">Nome atualizado.</p>
          )}
          <Button
            type="submit"
            disabled={
              !nameChanged ||
              !userService.isValidName(name) ||
              updateNameMutation.isPending
            }
          >
            {updateNameMutation.isPending ? "Salvando..." : "Salvar nome"}
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-2">
        <p className="text-sm font-medium text-slate-700">Notificações</p>
        <PushNotificationsControl />
      </Card>

      {logoutMutation.isError && (
        <p className="text-sm text-red-600">{logoutMutation.error.message}</p>
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
