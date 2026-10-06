import { enrollmentApi } from "./api";
import {
  AdminEnrollee,
  AdminEnrollmentSummary,
  GuestEnrollee,
  GuestEnrollmentSummary,
  MyEnrollmentSummary,
  Side,
} from "./types";

// Códigos de cancelamento das inscrições feitas sem conta neste aparelho —
// é o único jeito de o convidado ver e cancelar a própria vaga. Limpar os
// dados do navegador perde os códigos: aí só o admin remove.
const GUEST_TOKENS_KEY = "guestEnrollmentTokens";
// Os mais recentes bastam (as aulas antigas já passaram); o backend aceita
// até 100 por consulta.
const MAX_GUEST_TOKENS = 50;
// Último nome/lado usados sem conta, pra não digitar de novo toda semana.
const GUEST_PROFILE_KEY = "guestEnrollmentProfile";

function enrollMeInClass(classId: number) {
  return enrollmentApi.enrollMeInClass(classId);
}

function cancelMyEnrollmentInClass(classId: number) {
  return enrollmentApi.cancelMyEnrollmentInClass(classId);
}

function adminEnrollInClass(classId: number, enrollee: AdminEnrollee) {
  return enrollmentApi.adminEnrollInClass(classId, enrollee);
}

// Inscreve sem conta e guarda o código de cancelamento (e o nome/lado pra
// próxima vez) neste aparelho.
async function enrollGuestInClass(classId: number, enrollee: GuestEnrollee) {
  const { cancelToken } = await enrollmentApi.enrollGuestInClass(
    classId,
    enrollee,
  );
  writeGuestTokens([cancelToken, ...readGuestTokens()]);
  writeGuestProfile(enrollee);
}

async function cancelGuestEnrollmentInClass(
  classId: number,
  cancelToken: string,
) {
  await enrollmentApi.cancelGuestEnrollmentInClass(classId, cancelToken);
  writeGuestTokens(readGuestTokens().filter(t => t !== cancelToken));
}

// Consulta as inscrições dos códigos guardados e esquece os que não voltam
// (o admin removeu, a turma foi excluída).
async function getGuestEnrollments(): Promise<GuestEnrollmentSummary[]> {
  const tokens = readGuestTokens();
  if (tokens.length === 0) return [];

  const found = await enrollmentApi.lookupGuestEnrollments(tokens);
  const alive = new Set(found.map(e => e.cancelToken));
  if (alive.size < tokens.length) {
    // Relê o storage: uma inscrição feita durante a consulta não é perdida.
    writeGuestTokens(
      readGuestTokens().filter(t => alive.has(t) || !tokens.includes(t)),
    );
  }
  return found;
}

function hasGuestEnrollments(): boolean {
  return readGuestTokens().length > 0;
}

function findGuestEnrollmentInClass(
  guestEnrollments: GuestEnrollmentSummary[],
  classId: number,
): GuestEnrollmentSummary | null {
  return guestEnrollments.find(e => e.classSessionId === classId) ?? null;
}

// `localStorage` pode lançar (modo privado/bloqueado): sem ele a inscrição
// funciona, só não dá pra cancelar depois por este aparelho.
function readGuestTokens(): string[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(GUEST_TOKENS_KEY) ?? "[]",
    );
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === "string")
      : [];
  } catch {
    return [];
  }
}

function writeGuestTokens(tokens: string[]) {
  try {
    localStorage.setItem(
      GUEST_TOKENS_KEY,
      JSON.stringify(tokens.slice(0, MAX_GUEST_TOKENS)),
    );
  } catch {
    // Idem.
  }
}

function readGuestProfile(): Partial<GuestEnrollee> {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(GUEST_PROFILE_KEY) ?? "{}",
    );
    if (typeof parsed !== "object" || parsed === null) return {};
    const { guestName, side } = parsed as Record<string, unknown>;
    return {
      guestName: typeof guestName === "string" ? guestName : undefined,
      side: side === "LEFT" || side === "RIGHT" ? side : undefined,
    };
  } catch {
    return {};
  }
}

function writeGuestProfile(profile: GuestEnrollee) {
  try {
    localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Sem storage só não pré-preenche da próxima vez.
  }
}

function removeEnrollment(classId: number, enrollmentId: number) {
  return enrollmentApi.removeEnrollment(classId, enrollmentId);
}

function getMyEnrollments() {
  return enrollmentApi.getMyEnrollments();
}

function sideLabel(side: Side): string {
  return side === "LEFT" ? "Esquerda" : "Direita";
}

// A inscrição do usuário logado numa turma, a partir de "minhas aulas" —
// é assim que a tela pública sabe se mostra "Quero participar" ou
// "Cancelar minha vaga" (a lista pública só tem nomes).
function findMyEnrollmentInClass(
  myEnrollments: MyEnrollmentSummary[],
  classId: number,
): MyEnrollmentSummary | null {
  return myEnrollments.find(e => e.classSession.id === classId) ?? null;
}

function isGuest(enrollment: AdminEnrollmentSummary): boolean {
  return enrollment.userId === null;
}

export const enrollmentService = {
  enrollMeInClass,
  cancelMyEnrollmentInClass,
  adminEnrollInClass,
  enrollGuestInClass,
  cancelGuestEnrollmentInClass,
  getGuestEnrollments,
  hasGuestEnrollments,
  findGuestEnrollmentInClass,
  readGuestProfile,
  removeEnrollment,
  getMyEnrollments,
  sideLabel,
  findMyEnrollmentInClass,
  isGuest,
};
