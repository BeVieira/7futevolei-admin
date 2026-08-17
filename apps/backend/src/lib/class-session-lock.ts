// `date` fica salvo como meia-noite UTC e `lockAt` é digitado pelo admin no
// horário local (America/Sao_Paulo, UTC-3 o ano todo — sem horário de verão
// desde 2019). Sem esse deslocamento, "22:00" seria interpretado como 22h UTC
// (19h no Brasil), trancando a lista 3h antes da hora real escolhida.
const BRAZIL_UTC_OFFSET_HOURS = 3;

export function computeLockAt(date: Date, lockAt: string | null): Date | null {
  if (!lockAt) return null;

  const [hours, minutes] = lockAt.split(":").map(Number);
  const lockDate = new Date(date);
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
