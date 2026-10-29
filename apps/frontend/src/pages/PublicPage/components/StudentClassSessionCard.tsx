import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SideSlots } from "./SideSlots";
import { PushNotificationsInvite } from "./PushNotificationsInvite";
import { SignupInviteModal } from "./SignupInviteModal";
import { WaitlistModal } from "./WaitlistModal";
import { Button, ClassSessionCard } from "@components";
import { PeopleIcon } from "@assets";
import {
  ClassSessionSummary,
  GuestEnrollmentSummary,
  Me,
  MyEnrollmentSummary,
  Side,
  authService,
  aulaService,
  enrollmentService,
  useCancelGuestEnrollment,
  useCancelMyEnrollment,
  useEnrollGuest,
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
  // Inscrição sem conta feita deste aparelho nesta turma, ou `null`.
  guestEnrollment: GuestEnrollmentSummary | null;
};

export function StudentClassSessionCard({
  session,
  me,
  myEnrollment,
  guestEnrollment,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [acceptsLockCommitment, setAcceptsLockCommitment] = useState(false);
  // Convite de notificações: só no card da inscrição que acabou de dar certo.
  const [showPushInvite, setShowPushInvite] = useState(false);
  // Convite pra criar conta depois da inscrição sem conta (no máximo um a
  // cada 24h neste aparelho). Guarda se caiu na lista de espera.
  const [signupInvite, setSignupInvite] = useState<{
    waitlisted: boolean;
  } | null>(null);
  // Inscrição sem conta: nome e lado digitados, pré-preenchidos com os da
  // última vez neste aparelho.
  const [guestName, setGuestName] = useState(
    () => enrollmentService.readGuestProfile().guestName ?? "",
  );
  const [guestSide, setGuestSide] = useState<Side | "">(
    () => enrollmentService.readGuestProfile().side ?? "",
  );

  const sideCapacity = aulaService.getSideCapacity(session.capacity);
  const isSideFull = (side: Side) =>
    (side === "LEFT"
      ? session.confirmedLeft.length
      : session.confirmedRight.length) >= sideCapacity;
  // O usuário sempre entra no lado do perfil — é a lotação desse lado que
  // decide se a inscrição vira lista de espera.
  const mySide = me?.preferredSide ?? null;
  const mySideFull = mySide !== null && isSideFull(mySide);
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
  const enrollGuestMutation = useEnrollGuest(session.id);
  const cancelGuestMutation = useCancelGuestEnrollment(session.id);

  const { data: classDetail, isLoading: waitlistLoading } = useGetClassById(
    session.id,
    { enabled: waitlistOpen },
  );

  function closeForm() {
    setShowForm(false);
    setAcceptsLockCommitment(false);
  }

  function enroll() {
    enrollMutation.mutate(undefined, {
      onSuccess: () => {
        setShowPushInvite(true);
        closeForm();
      },
    });
  }

  // Logado sem lado no perfil, vai escolher o lado e volta. Logado com tudo
  // certo, a inscrição é direta — o formulário só aparece com a lista
  // trancada, pra aceitar o compromisso. Sem login, o formulário pede nome e
  // lado (o convite pra criar conta vem depois, no `SignupInviteModal`).
  function participate() {
    if (me && !me.preferredSide) {
      navigate("/perfil", {
        state: { from: location.pathname + location.search },
      });
      return;
    }
    if (!me || session.isLocked) {
      setCollapsed(false);
      setShowForm(true);
      return;
    }
    enroll();
  }

  function login() {
    navigate("/login", {
      state: { from: location.pathname + location.search },
    });
  }

  function handleSubmitForm(e: FormEvent) {
    e.preventDefault();
    if (session.isLocked && !acceptsLockCommitment) return;
    if (me) {
      enroll();
      return;
    }
    const name = guestName.trim();
    if (!name || !guestSide) return;
    const waitlisted = isSideFull(guestSide);
    enrollGuestMutation.mutate(
      { guestName: name, side: guestSide },
      {
        onSuccess: () => {
          closeForm();
          if (authService.takeSignupInvite()) setSignupInvite({ waitlisted });
        },
      },
    );
  }

  function handleCancel() {
    cancelMutation.mutate(undefined, {
      onSuccess: () => setShowPushInvite(false),
    });
  }

  function handleCancelGuest(cancelToken: string) {
    cancelGuestMutation.mutate(cancelToken);
  }

  function handleJoinWaitlist() {
    setWaitlistOpen(false);
    participate();
  }

  const submitting =
    enrollMutation.isPending ||
    cancelMutation.isPending ||
    enrollGuestMutation.isPending ||
    cancelGuestMutation.isPending;
  const actionError =
    enrollMutation.error ??
    cancelMutation.error ??
    enrollGuestMutation.error ??
    cancelGuestMutation.error;
  // Inscrição que este aparelho conhece: a da conta logada ou, sem ela, a
  // feita sem conta.
  const enrolled = myEnrollment
    ? {
        name: me?.name ?? "",
        status: myEnrollment.enrollment.status,
        cancel: handleCancel,
      }
    : guestEnrollment
      ? {
          name: guestEnrollment.enrollment.studentName,
          status: guestEnrollment.enrollment.status,
          cancel: () => handleCancelGuest(guestEnrollment.cancelToken),
        }
      : null;

  return (
    <>
      {waitlistOpen && (
        <WaitlistModal
          waitlist={classDetail?.waitlist ?? []}
          loading={waitlistLoading}
          onClose={() => setWaitlistOpen(false)}
          onJoinWaitlist={enrolled ? undefined : handleJoinWaitlist}
        />
      )}

      {signupInvite && (
        <SignupInviteModal
          session={session}
          guestName={guestName}
          waitlisted={signupInvite.waitlisted}
          onLogin={login}
          onClose={() => setSignupInvite(null)}
        />
      )}

      <ClassSessionCard
        title={session.classLevel}
        occupancy={{ filled: session.confirmedCount, total: session.capacity }}
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
        headerRight={
          <>
            {session.waitlistCount > 0 && (
              <button
                type="button"
                onClick={() => setWaitlistOpen(true)}
                className="num whitespace-nowrap rounded-full border border-warning-border bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning-ink"
              >
                {session.waitlistCount} na espera
              </button>
            )}
            <span
              className="num flex items-center gap-1.5 text-sm text-muted"
              aria-label={`${session.confirmedCount} de ${session.capacity} vagas preenchidas`}
            >
              <PeopleIcon className="h-4 w-4" />
              <span>
                <span className="font-semibold text-ink">
                  {session.confirmedCount}
                </span>
                /{session.capacity}
              </span>
            </span>
          </>
        }
      >
        {/* A quadra: os dois lados lado a lado, a rede (linha branca) no meio. */}
        <div className="grid grid-cols-2 divide-x-2 divide-card overflow-hidden rounded-md bg-accent-soft">
          <SideSlots label="Esquerda" names={leftSlots} />
          <SideSlots label="Direita" names={rightSlots} />
        </div>

        {actionError && (
          <p className="text-sm text-negative">{actionError.message}</p>
        )}

        {enrolled ? (
          <div className="flex flex-col gap-2">
            <p
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                enrolled.status === "WAITLISTED"
                  ? "border border-warning-border bg-warning-bg text-warning-ink"
                  : "bg-accent-soft text-accent-ink"
              }`}
            >
              {enrolled.status === "WAITLISTED"
                ? `${enrolled.name}, você está na lista de espera`
                : `${enrolled.name}, você está inscrito`}
            </p>
            {showPushInvite && <PushNotificationsInvite />}
            {session.isLocked ? (
              <p className="text-xs text-muted">
                Lista trancada — não é mais possível cancelar. Fale com o
                professor em caso de imprevisto.
              </p>
            ) : (
              <Button
                variant="danger"
                onClick={enrolled.cancel}
                disabled={submitting}
              >
                Cancelar minha vaga
              </Button>
            )}
          </div>
        ) : showForm && (!me || mySide) ? (
          <form onSubmit={handleSubmitForm} className="flex flex-col gap-3">
            {me && mySide ? (
              <p className="text-sm text-muted">
                Inscrevendo <span className="font-medium text-ink">{me.name}</span> no
                lado {enrollmentService.sideLabel(mySide).toLowerCase()}
                {mySideFull ? " (lista de espera)" : ""}
              </p>
            ) : (
              <>
                <input
                  type="text"
                  required
                  maxLength={100}
                  placeholder="Seu nome"
                  aria-label="Seu nome"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  className="field"
                />
                <div className="grid grid-cols-2 gap-2">
                  {(["LEFT", "RIGHT"] as const).map(side => (
                    <label key={side} className="option">
                      <input
                        type="radio"
                        required
                        name={`guest-side-${session.id}`}
                        value={side}
                        checked={guestSide === side}
                        onChange={() => setGuestSide(side)}
                      />
                      <span className="flex flex-col leading-tight">
                        {enrollmentService.sideLabel(side)}
                        {isSideFull(side) && (
                          <span className="text-xs font-normal text-muted">
                            lista de espera
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
            {session.isLocked && (
              <div className="rounded-md border border-warning-border bg-warning-bg p-3 text-sm text-warning-ink">
                <p className="mb-2.5 font-medium">
                  A lista dessa aula já está trancada. Ao se inscrever agora
                  você não poderá mais cancelar e se compromete a participar,
                  mediante pagamento, mesmo em caso de ausência.
                </p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    required
                    checked={acceptsLockCommitment}
                    onChange={e => setAcceptsLockCommitment(e.target.checked)}
                  />
                  Estou ciente e concordo
                </label>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={
                  submitting ||
                  (session.isLocked && !acceptsLockCommitment) ||
                  (!me && (!guestName.trim() || !guestSide))
                }
              >
                Confirmar
              </Button>
              <Button type="button" variant="secondary" onClick={closeForm}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Button onClick={participate} disabled={submitting}>
              {me && !mySide
                ? "Escolher meu lado para participar"
                : mySideFull
                  ? "Entrar na lista de espera"
                  : "Quero participar"}
            </Button>
            {mySide && (
              <p className="text-xs text-muted">
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
