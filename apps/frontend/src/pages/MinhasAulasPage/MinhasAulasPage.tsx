import { FormEvent, useState } from "react";
import { Button, Card, Tabs } from "../../components";
import {
  enrollmentService,
  enrollmentTypes,
  useGetMyEnrollments,
} from "../../domain/enrollment";
import { MyEnrollmentCard } from "./components/MyEnrollmentCard";

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
  entry: enrollmentTypes.MyEnrollmentSummary,
  filter: ReceiptFilter,
): boolean {
  if (filter === "ALL") return true;
  if (filter === "PENDING") {
    return !entry.receipt || entry.receipt.status === "PENDING";
  }
  return entry.receipt?.status === filter;
}

export function MinhasAulasPage() {
  const [myName, setMyName] = useState(() => enrollmentService.getMyName());
  const [nameInput, setNameInput] = useState("");
  const [filter, setFilter] = useState<ReceiptFilter>("PENDING");

  const {
    data: entries = [],
    isLoading,
    isError,
    error,
  } = useGetMyEnrollments(myName ?? "");

  const filteredEntries = entries.filter((entry) =>
    matchesFilter(entry, filter),
  );

  const tabs = FILTER_TABS.map((tab) => ({
    ...tab,
    showIndicator:
      (tab.key === "PENDING" || tab.key === "REJECTED") &&
      entries.some((entry) => matchesFilter(entry, tab.key)),
  }));

  function handleConfirmName(e: FormEvent) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    enrollmentService.rememberMyName(nameInput.trim());
    setMyName(nameInput.trim());
  }

  function handleForgetName() {
    enrollmentService.forgetMyName();
    setMyName(null);
    setNameInput("");
  }

  if (!myName) {
    return (
      <Card className="flex flex-col gap-3">
        <p className="text-sm font-medium text-slate-700">Quem é você?</p>
        <form onSubmit={handleConfirmName} className="flex flex-col gap-2">
          <input
            autoFocus
            required
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Seu nome"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
          <Button type="submit">Ver minhas aulas</Button>
        </form>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Aulas de <span className="font-medium">{myName}</span>
        </p>
        <button
          type="button"
          onClick={handleForgetName}
          className="text-xs text-teal-600 underline"
        >
          Trocar nome
        </button>
      </div>

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
        {filteredEntries.map((entry) => (
          <MyEnrollmentCard
            key={entry.enrollment.id}
            entry={entry}
            studentName={myName}
          />
        ))}
      </div>
    </div>
  );
}
