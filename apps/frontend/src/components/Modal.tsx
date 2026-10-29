import { ReactNode } from "react";
import { CloseIcon } from "@assets";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

// No celular abre como folha presa ao rodapé (fácil de alcançar com o
// polegar); a partir de `sm`, centralizado.
export function Modal({ title, onClose, children }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:max-w-sm sm:rounded-lg sm:pb-5"
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-1.5 rounded-md p-1.5 text-muted hover:bg-raised hover:text-ink"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
