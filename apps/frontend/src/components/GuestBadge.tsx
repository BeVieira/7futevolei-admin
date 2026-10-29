// Etiqueta de inscrição de convidado (só nome, sem conta) — aparece só nas
// telas do admin; a tela pública mostra só o nome.
export function GuestBadge() {
  return (
    <span className="flex-none whitespace-nowrap rounded-full bg-raised px-2 py-0.5 text-[11px] font-medium text-muted">
      convidado
    </span>
  );
}
