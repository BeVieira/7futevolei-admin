import { useMemo, useState } from "react";
import { StudentClassSessionCard } from "./components/StudentClassSessionCard";
import {
  CalendarModal,
  CollapsibleSectionHeader,
  DatePickerButton,
} from "@components";
import {
  aulaService,
  enrollmentService,
  useGetClassesByDate,
  useGetGuestEnrollments,
  useGetMe,
  useGetMyEnrollments,
  useGetNextAvailableDate,
} from "@domain";
import { pluralize } from "@utils";

export function PublicPage() {
  const { data: nextAvailableDate } = useGetNextAvailableDate();
  const [manualDate, setManualDate] = useState<string | null>(null);
  const [collapsedSlots, setCollapsedSlots] = useState<Set<string>>(
    () => new Set(),
  );
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Enquanto a próxima data com aulas ainda não chegou, não escolhemos "hoje"
  // como padrão — senão o usuário vê a tela vazia de "hoje" piscar antes de
  // corrigir pra data certa.
  const date = manualDate ?? nextAvailableDate ?? "";

  const {
    data: sessions = [],
    isLoading: isLoadingSessions,
    isError,
    error,
  } = useGetClassesByDate(date, { enabled: Boolean(date) });

  const isLoading = isLoadingSessions || !date;

  // A lista pública só tem nomes; é por "minhas aulas" (uma query só pra
  // tela toda, não uma por card) que cada card sabe se o usuário logado
  // está inscrito nele.
  const { data: me } = useGetMe();
  const { data: myEnrollments = [] } = useGetMyEnrollments({
    enabled: Boolean(me),
  });
  // Inscrições sem conta feitas deste aparelho (logado ou não — quem se
  // inscreveu sem conta e depois logou continua vendo e cancelando a vaga).
  const { data: guestEnrollments = [] } = useGetGuestEnrollments();

  const groups = useMemo(
    () => aulaService.groupClassesByTimeSlot(sessions),
    [sessions],
  );

  function toggleSlot(slotKey: string) {
    setCollapsedSlots(prev => {
      const next = new Set(prev);
      if (next.has(slotKey)) {
        next.delete(slotKey);
      } else {
        next.add(slotKey);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[32px]">
            Aulas
          </h1>
          <p className="num text-sm text-muted">
            {!isLoading && sessions.length > 0
              ? `${pluralize(groups.length, "horário", "horários")} · ${pluralize(sessions.length, "turma", "turmas")}`
              : "Escolha a data, a turma e o seu lado da quadra."}
          </p>
        </div>
        <DatePickerButton date={date} onClick={() => setCalendarOpen(true)} />
      </div>

      {calendarOpen && date && (
        <CalendarModal
          selectedDate={date}
          onSelect={selected => {
            setManualDate(selected);
            setCalendarOpen(false);
          }}
          onClose={() => setCalendarOpen(false)}
        />
      )}

      {isLoading && <p className="text-sm text-muted">Carregando...</p>}
      {isError && <p className="text-sm text-negative">{error?.message}</p>}
      {!isLoading && !isError && sessions.length === 0 && (
        <p className="rounded-lg border border-dashed border-control px-4 py-6 text-center text-sm text-muted">
          Ainda não há turmas cadastradas para esta data.
        </p>
      )}

      {groups.map(([slotKey, slotSessions]) => {
        const totalConfirmados = slotSessions.reduce(
          (sum, s) => sum + s.confirmedCount,
          0,
        );
        const totalVagas = slotSessions.reduce((sum, s) => sum + s.capacity, 0);
        const isCollapsed = !collapsedSlots.has(slotKey);

        return (
          <section key={slotKey} className="flex flex-col gap-4">
            <CollapsibleSectionHeader
              label={`${slotSessions[0].startTime} - ${slotSessions[0].endTime}`}
              meta={`${pluralize(slotSessions.length, "turma", "turmas")} · ${totalConfirmados} de ${totalVagas} vagas`}
              collapsed={isCollapsed}
              onToggle={() => toggleSlot(slotKey)}
            />
            {!isCollapsed && (
              <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {slotSessions.map(session => (
                  <StudentClassSessionCard
                    key={session.id}
                    session={session}
                    me={me ?? null}
                    myEnrollment={enrollmentService.findMyEnrollmentInClass(
                      myEnrollments,
                      session.id,
                    )}
                    guestEnrollment={enrollmentService.findGuestEnrollmentInClass(
                      guestEnrollments,
                      session.id,
                    )}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
