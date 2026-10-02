// Etiqueta de inscrição de convidado (só nome, sem conta) — aparece só nas
// telas do admin; a tela pública mostra só o nome.
export function GuestBadge() {
  return (
    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
      convidado
    </span>
  );
}
