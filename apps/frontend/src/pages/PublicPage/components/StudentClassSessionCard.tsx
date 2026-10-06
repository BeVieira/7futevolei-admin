import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SideSlots } from "./SideSlots";
import { PushNotificationsInvite } from "./PushNotificationsInvite";
import { WaitlistModal } from "./WaitlistModal";
import { Button, ClassSessionCard } from "@components";
import { PeopleIcon } from "@assets";
import {
  ClassSessionSummary,
  Me,
  MyEnrollmentSummary,
  aulaService,
  enrollmentService,
  useCancelMyEnrollment,
  useEnrollStudent,
  useGetClassById,
} from "@domain";

type Props = {
  session: ClassSessionSummary;
  // `null` = ninguém logado.
  me: Me | null;
  // Inscrição do usuário logado nesta turma (vem de "minhas aulas"), ou
  // `null` se não está inscrito.
  myEnrollment: MyEnrollmentSummary | null;
};

export function StudentClassSessionCard({ session, me, myEnrollment }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [acceptsLockCommitment, setAcceptsLockCommitment] = useState(false);
  // Convite de notificações: só no card da inscrição que acabou de dar certo.
  const [showPushInvite, setShowPushInvite] = useState(false);

  const sideCapacity = aulaService.getSideCapacity(session.capacity);
  // O usuário sempre entra no lado do perfil — é a lotação desse lado que
  // decide se a inscrição vira lista de espera.
  const mySide = me?.preferredSide ?? null;
  const mySideFull =
    mySide !== null &&
    (mySide === "LEFT"
      ? session.confirmedLeft.length
      : session.confirmedRight.length) >= sideCapacity;
  const leftSlots = Array.from(
    { length: sideCapacity },
    (_, i) => session.confirmedLeft[i] ?? null,
  );
  const rightSlots = Array.from(
    { length: sideCapacity },
    (_, i) => session.confirmedRight[i] ?? null,
  );

  const enrollMutation = useEnrollStudent(session.id);
  const cancelMutation = useCancelMyEnrollment(session.id);

  const { data: classDetail, isLoading: waitlistLoading } = useGetClassById(
    session.id,
    { enabled: waitlistOpen },
  );

  function enroll() {
    enrollMutation.mutate(undefined, {
      onSuccess: () => {
        setShowPushInvite(true);
        setShowForm(false);
        setAcceptsLockCommitment(false);
      },
    });
  }

  // Sem login, quem quer participar vai pro login e volta pra esta tela;
  // sem lado no perfil, vai escolher o lado e volta. Com tudo certo, a
  // inscrição é direta — o formulário só aparece com a lista trancada, pra
  // aceitar o compromisso.
  function participate() {
    const here = { from: location.pathname + location.search };
    if (!me) {
      navigate("/login", { state: here });
      return;
    }
    if (!me.preferredSide) {
      navigate("/perfil", { state: here });
      return;
    }
    if (session.isLocked) {
      setCollapsed(false);
      setShowForm(true);
      return;
    }
    enroll();
  }

  function handleConfirmLocked(e: FormEvent) {
    e.preventDefault();
    if (!acceptsLockCommitment) return;
    enroll();
  }

  function handleCancel() {
    cancelMutation.mutate(undefined, {
      onSuccess: () => setShowPushInvite(false),
    });
  }

  function handleJoinWaitlist() {
    setWaitlistOpen(false);
    participate();
  }

  const submitting = enrollMutation.isPending || cancelMutation.isPending;
  const actionError = enrollMutation.error ?? cancelMutation.error;

  return (
    <>
      {waitlistOpen && (
        <WaitlistModal
          waitlist={classDetail?.waitlist ?? []}
          loading={waitlistLoading}
          onClose={() => setWaitlistOpen(false)}
          onJoinWaitlist={myEnrollment ? undefined : handleJoinWaitlist}
        />
      )}

      <ClassSessionCard
        title={session.classLevel}
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
        headerRight={
          <>
            {session.waitlistCount > 0 && (
              <button
                type="button"
                onClick={() => setWaitlistOpen(true)}
                className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-200"
              >
                {session.waitlistCount} na espera
              </button>
            )}
            <span className="flex items-center gap-1.5 text-sm text-slate-600">
              <PeopleIcon className="h-4 w-4" />
              {session.confirmedCount}/{session.capacity}
            </span>
          </>
        }
      >
        <SideSlots label="Esquerda" names={leftSlots} />
        <SideSlots label="Direita" names={rightSlots} />

        {actionError && (
          <p className="text-xs text-red-600">{actionError.message}</p>
        )}

        {me && myEnrollment ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-teal-500">
              {myEnrollment.enrollment.status === "WAITLISTED"
                ? `${me.name}, você está na lista de espera`
                : `${me.name}, você está inscrito`}
            </p>
            {showPushInvite && <PushNotificationsInvite />}
            {session.isLocked ? (
              <p className="text-xs text-slate-500">
                Lista trancada — não é mais possível cancelar. Fale com o
                professor em caso de imprevisto.
              </p>
            ) : (
              <Button
                variant="danger"
                onClick={handleCancel}
                disabled={submitting}
              >
                Cancelar minha vaga
              </Button>
            )}
          </div>
        ) : showForm && me && mySide ? (
          <form onSubmit={handleConfirmLocked} className="flex flex-col gap-2">
            <p className="text-sm text-slate-600">
              Inscrevendo <span className="font-medium">{me.name}</span> no lado{" "}
              {enrollmentService.sideLabel(mySide).toLowerCase()}
              {mySideFull ? " (lista de espera)" : ""}
            </p>
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="mb-2 font-medium">
                A lista dessa aula já está trancada. Ao se inscrever agora você
                não poderá mais cancelar e se compromete a participar, mediante
                pagamento, mesmo em caso de ausência.
              </p>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  required
                  checked={acceptsLockCommitment}
                  onChange={e => setAcceptsLockCommitment(e.target.checked)}
                />
                Estou ciente e concordo
              </label>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={submitting || !acceptsLockCommitment}
              >
                Confirmar
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowForm(false);
                  setAcceptsLockCommitment(false);
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-1">
            <Button onClick={participate} disabled={submitting}>
              {!me
                ? "Entrar para participar"
                : !mySide
                  ? "Escolher meu lado para participar"
                  : mySideFull
                    ? "Entrar na lista de espera"
                    : "Quero participar"}
            </Button>
            {mySide && (
              <p className="text-xs text-slate-500">
                Você entra no lado{" "}
                {enrollmentService.sideLabel(mySide).toLowerCase()} — dá pra
                trocar no perfil.
              </p>
            )}
          </div>
        )}
      </ClassSessionCard>
    </>
  );
}
