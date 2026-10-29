import { useState } from "react";
import { MyEnrollmentCard } from "./components/MyEnrollmentCard";
import { Tabs } from "@components";
import { MyEnrollmentSummary, useGetMyEnrollments } from "@domain";

type ReceiptFilter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

const FILTER_TABS: { key: ReceiptFilter; label: string }[] = [
  { key: "PENDING", label: "Pendentes" },
  { key: "APPROVED", label: "Aprovados" },
  { key: "REJECTED", label: "Negados" },
  { key: "ALL", label: "Todos" },
];

const FILTER_LABELS: Record<ReceiptFilter, string> = {
  PENDING: "pendente",
  APPROVED: "aprovada",
  REJECTED: "negada",
  ALL: "",
};

function matchesFilter(
  entry: MyEnrollmentSummary,
  filter: ReceiptFilter,
): boolean {
  if (filter === "ALL") return true;
  if (filter === "PENDING") {
    return !entry.receipt || entry.receipt.status === "PENDING";
  }
  return entry.receipt?.status === filter;
}

// Rota protegida por `RequireAuth`: as inscrições são as do usuário da
// sessão (nada de nome digitado).
export function MinhasAulasPage() {
  const [filter, setFilter] = useState<ReceiptFilter>("PENDING");

  const {
    data: entries = [],
    isLoading,
    isError,
    error,
  } = useGetMyEnrollments();

  const filteredEntries = entries.filter(entry => matchesFilter(entry, filter));

  const tabs = FILTER_TABS.map(tab => ({
    ...tab,
    showIndicator:
      (tab.key === "PENDING" || tab.key === "REJECTED") &&
      entries.some(entry => matchesFilter(entry, tab.key)),
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[32px]">
        Comprovantes
      </h1>

      <Tabs options={tabs} active={filter} onChange={setFilter} />

      {isLoading && <p className="text-sm text-muted">Carregando...</p>}
      {isError && <p className="text-sm text-negative">{error?.message}</p>}
      {!isLoading && !isError && entries.length === 0 && (
        <p className="rounded-lg border border-dashed border-control px-4 py-6 text-center text-sm text-muted">
          Nenhuma inscrição encontrada.
        </p>
      )}
      {!isLoading &&
        !isError &&
        entries.length > 0 &&
        filteredEntries.length === 0 && (
          <p className="rounded-lg border border-dashed border-control px-4 py-6 text-center text-sm text-muted">
            Nenhuma inscrição {FILTER_LABELS[filter]} no momento.
          </p>
        )}

      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredEntries.map(entry => (
          <MyEnrollmentCard key={entry.enrollment.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
