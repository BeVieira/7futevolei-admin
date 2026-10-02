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
    <div className="flex flex-col gap-4">
      <Tabs options={tabs} active={filter} onChange={setFilter} />

      {isLoading && <p className="text-slate-500">Carregando...</p>}
      {isError && <p className="text-red-600">{error?.message}</p>}
      {!isLoading && !isError && entries.length === 0 && (
        <p className="text-slate-500">Nenhuma inscrição encontrada.</p>
      )}
      {!isLoading &&
        !isError &&
        entries.length > 0 &&
        filteredEntries.length === 0 && (
          <p className="text-slate-500">
            Nenhuma inscrição {FILTER_LABELS[filter]} no momento.
          </p>
        )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filteredEntries.map(entry => (
          <MyEnrollmentCard key={entry.enrollment.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
