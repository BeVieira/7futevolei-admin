// `date` fica salvo como meia-noite UTC e `lockAt` é digitado pelo admin no
// horário local (America/Sao_Paulo, UTC-3 o ano todo — sem horário de verão
// desde 2019). Sem esse deslocamento, "22:00" seria interpretado como 22h UTC
// (19h no Brasil), trancando a lista 3h antes da hora real escolhida.
export const BRAZIL_UTC_OFFSET_HOURS = 3;

export function computeLockAt(date: Date, lockAt: string | null): Date | null {
  if (!lockAt) return null;

  const [hours, minutes] = lockAt.split(":").map(Number);
  const lockDate = new Date(date);
  // A lista tranca no dia ANTERIOR ao da aula, no horário escolhido pelo admin.
  lockDate.setUTCDate(lockDate.getUTCDate() - 1);
  lockDate.setUTCHours(hours + BRAZIL_UTC_OFFSET_HOURS, minutes, 0, 0);
  return lockDate;
}

export function isClassSessionLocked(
  date: Date,
  lockAt: string | null,
  now: Date = new Date(),
): boolean {
  const lockDate = computeLockAt(date, lockAt);
  return lockDate !== null && now >= lockDate;
}

// Instante real em que a aula termina: `date` (meia-noite UTC do dia no
// Brasil) + `endTime` no horário de Brasília. Uma aula das 23h termina
// "00:00" — o fim cai no dia seguinte.
export function computeClassSessionEnd(classSession: {
  date: Date;
  startTime: string;
  endTime: string;
}): Date {
  const [hours, minutes] = classSession.endTime.split(":").map(Number);
  const end = new Date(classSession.date);
  if (classSession.endTime <= classSession.startTime) {
    end.setUTCDate(end.getUTCDate() + 1);
  }
  end.setUTCHours(hours + BRAZIL_UTC_OFFSET_HOURS, minutes, 0, 0);
  return end;
}

export function hasClassSessionEnded(
  classSession: { date: Date; startTime: string; endTime: string },
  now: Date = new Date(),
): boolean {
  return now >= computeClassSessionEnd(classSession);
}
