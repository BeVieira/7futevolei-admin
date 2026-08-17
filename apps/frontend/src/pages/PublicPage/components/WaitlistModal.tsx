import { Button, Modal } from "../../../components";
import { enrollmentService, enrollmentTypes } from "../../../domain/enrollment";

type Props = {
  waitlist: enrollmentTypes.EnrollmentSummary[];
  loading: boolean;
  onClose: () => void;
  onJoinWaitlist?: () => void;
};

export function WaitlistModal({
  waitlist,
  loading,
  onClose,
  onJoinWaitlist,
}: Props) {
  return (
    <Modal title="Lista de espera" onClose={onClose}>
      {loading && <p className="text-sm text-slate-400">Carregando...</p>}
      {!loading && waitlist.length === 0 && (
        <p className="text-sm text-slate-400">Ninguém na lista de espera.</p>
      )}
      {!loading && waitlist.length > 0 && (
        <ul className="flex flex-col gap-2">
          {waitlist.map((enrollment) => (
            <li
              key={enrollment.id}
              className="flex items-center justify-between rounded-xl bg-background px-3 py-2 text-sm"
            >
              <span className="font-medium text-slate-800">
                {enrollment.studentName}
              </span>
              <span className="text-xs text-slate-500">
                {enrollmentService.sideLabel(enrollment.side)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {onJoinWaitlist && (
        <Button className="mt-3" onClick={onJoinWaitlist}>
          Entrar na lista de espera
        </Button>
      )}
    </Modal>
  );
}
