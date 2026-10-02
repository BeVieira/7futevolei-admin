import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SideSlots } from "./SideSlots";
import { WaitlistModal } from "./WaitlistModal";
import { Button, ClassSessionCard } from "@components";
import { PeopleIcon } from "@assets";
import {
  ClassSessionSummary,
  Me,
  MyEnrollmentSummary,
  Side,
  aulaService,
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
  const [side, setSide] = useState<Side | "">("");
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [acceptsLockCommitment, setAcceptsLockCommitment] = useState(false);

  const isFull = aulaService.isClassFull(session);
  const sideCapacity = aulaService.getSideCapacity(session.capacity);
  const leftCount = session.confirmedLeft.length;
  const rightCount = session.confirmedRight.length;
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

  // Sem login, quem quer participar vai pro login e volta pra esta tela.
  function openFormOrLogin() {
    if (!me) {
      navigate("/login", {
        state: { from: location.pathname + location.search },
      });
      return;
    }
    setCollapsed(false);
    setShowForm(true);
  }

  function handleEnroll(e: FormEvent) {
    e.preventDefault();
    if (!side) return;
    if (session.isLocked && !acceptsLockCommitment) return;
    enrollMutation.mutate(side, {
      onSuccess: () => {
        setShowForm(false);
        setSide("");
        setAcceptsLockCommitment(false);
      },
    });
  }

  function handleCancel() {
    cancelMutation.mutate();
  }

  function handleJoinWaitlist() {
    setWaitlistOpen(false);
    openFormOrLogin();
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
          // Bloco "já inscrito" — (integração, Dev 2) o convite pra ativar
          // notificações (<PushNotificationsInvite />) entra logo abaixo do
          // texto de inscrito.
          <div className="flex flex-col gap-2">
            <p className="text-sm text-teal-500">
              {myEnrollment.enrollment.status === "WAITLISTED"
                ? `${me.name}, você está na lista de espera`
                : `${me.name}, você está inscrito`}
            </p>
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
        ) : showForm && me ? (
          <form onSubmit={handleEnroll} className="flex flex-col gap-2">
            <p className="text-sm text-slate-600">
              Inscrevendo <span className="font-medium">{me.name}</span>
            </p>
            <div>
              <p className="mb-1 text-sm font-medium text-slate-600">
                Lado da quadra
              </p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="radio"
                    name={`side-${session.id}`}
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
                    name={`side-${session.id}`}
                    value="RIGHT"
                    required
                    checked={side === "RIGHT"}
                    onChange={() => setSide("RIGHT")}
                  />
                  Direita ({rightCount}/{sideCapacity}
                  {rightCount >= sideCapacity ? " — lista de espera" : ""})
                </label>
              </div>
            </div>
            {session.isLocked && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="mb-2 font-medium">
                  A lista dessa aula já está trancada. Ao se inscrever agora
                  você não poderá mais cancelar e se compromete a participar,
                  mediante pagamento, mesmo em caso de ausência.
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
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={
                  submitting ||
                  !side ||
                  (session.isLocked && !acceptsLockCommitment)
                }
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
          <Button onClick={openFormOrLogin}>
            {me
              ? isFull
                ? "Entrar na lista de espera"
                : "Quero participar"
              : "Entrar para participar"}
          </Button>
        )}
      </ClassSessionCard>
    </>
  );
}
