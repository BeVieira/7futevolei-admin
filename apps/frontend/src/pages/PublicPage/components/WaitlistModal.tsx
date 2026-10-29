import { Button, Modal } from "@components";
import { EnrollmentSummary, enrollmentService } from "@domain";

type Props = {
  waitlist: EnrollmentSummary[];
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
      {loading && <p className="text-sm text-muted">Carregando...</p>}
      {!loading && waitlist.length === 0 && (
        <p className="text-sm text-muted">Ninguém na lista de espera.</p>
      )}
      {!loading && waitlist.length > 0 && (
        // A ordem importa: é a ordem em que as vagas são oferecidas.
        <ol className="flex flex-col divide-y divide-rule">
          {waitlist.map((enrollment, position) => (
            <li
              key={enrollment.id}
              className="flex items-center gap-3 py-2.5 text-sm"
            >
              <span className="num w-5 text-right text-muted">
                {position + 1}.
              </span>
              <span className="flex-1 font-medium text-ink">
                {enrollment.studentName}
              </span>
              <span className="text-xs text-muted">
                {enrollmentService.sideLabel(enrollment.side)}
              </span>
            </li>
          ))}
        </ol>
      )}
      {onJoinWaitlist && (
        <Button className="mt-4 sm:w-full" onClick={onJoinWaitlist}>
          Entrar na lista de espera
        </Button>
      )}
    </Modal>
  );
}
