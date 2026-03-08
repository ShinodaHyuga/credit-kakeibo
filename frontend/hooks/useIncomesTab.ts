import { useCallback, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Income } from "@/types/models";
import type { IncomeDraft, IncomeSortKey, SortDirection } from "@/types/ui";

type ShowNotice = (message: string, error?: boolean) => void;

export function useIncomesTab(showNotice: ShowNotice, refreshAll: () => Promise<void>) {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [incomeDrafts, setIncomeDrafts] = useState<Record<number, IncomeDraft>>({});

  const [incomeFilterName, setIncomeFilterName] = useState("");
  const [incomeFilterActive, setIncomeFilterActive] = useState(true);
  const [incomeSort, setIncomeSort] = useState<{ key: IncomeSortKey; direction: SortDirection }>({
    key: "id",
    direction: "asc",
  });

  const [newIncomeName, setNewIncomeName] = useState("");
  const [newIncomeYearMonth, setNewIncomeYearMonth] = useState("");
  const [newIncomeAmount, setNewIncomeAmount] = useState<number>(0);
  const [newIncomeActive, setNewIncomeActive] = useState(true);
  const [newIncomeNote, setNewIncomeNote] = useState("");

  const loadIncomes = useCallback(async () => {
    const q = new URLSearchParams();
    if (incomeFilterName.trim()) q.set("name", incomeFilterName.trim());
    if (incomeFilterActive) q.set("active", "true");

    const data = await api.incomes(q);
    setIncomes(data);

    const drafts: Record<number, IncomeDraft> = {};
    for (const row of data) {
      drafts[row.id] = {
        name: row.name,
        yearMonth: row.yearMonth,
        amount: row.amount,
        isActive: row.isActive,
        note: row.note,
      };
    }
    setIncomeDrafts(drafts);
  }, [incomeFilterName, incomeFilterActive]);

  const sortedIncomes = useMemo(() => {
    const list = [...incomes];
    list.sort((a, b) => {
      let result = 0;
      switch (incomeSort.key) {
        case "id":
          result = a.id - b.id;
          break;
        case "name":
          result = a.name.localeCompare(b.name, "ja");
          break;
        case "yearMonth":
          result = a.yearMonth.localeCompare(b.yearMonth);
          break;
        case "amount":
          result = a.amount - b.amount;
          break;
      }
      return incomeSort.direction === "asc" ? result : -result;
    });
    return list;
  }, [incomes, incomeSort]);

  const incomeTotal = useMemo(() => incomes.reduce((sum, row) => sum + row.amount, 0), [incomes]);

  const incomeSortMark = useCallback((key: IncomeSortKey) => {
    if (incomeSort.key !== key) return "";
    return incomeSort.direction === "asc" ? " ▲" : " ▼";
  }, [incomeSort]);

  const onToggleIncomeSort = useCallback((key: IncomeSortKey) => {
    setIncomeSort((prev) => (prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
  }, []);

  const onSearch = useCallback(() => {
    void loadIncomes().catch((e) => showNotice((e as Error).message, true));
  }, [loadIncomes, showNotice]);

  const onClear = useCallback(() => {
    setIncomeFilterName("");
    setIncomeFilterActive(true);
    void loadIncomes().catch((e) => showNotice((e as Error).message, true));
  }, [loadIncomes, showNotice]);

  const onSave = useCallback((id: number) => {
    const draft = incomeDrafts[id];
    if (!draft) return;
    void api
      .updateIncome(id, draft)
      .then(() => refreshAll())
      .then(() => showNotice(`収入更新: #${id}`))
      .catch((e) => showNotice((e as Error).message, true));
  }, [incomeDrafts, refreshAll, showNotice]);

  const onDelete = useCallback((id: number) => {
    void api
      .deleteIncome(id)
      .then(() => refreshAll())
      .then(() => showNotice(`収入削除: #${id}`))
      .catch((e) => showNotice((e as Error).message, true));
  }, [refreshAll, showNotice]);

  const onCreate = useCallback(() => {
    void api
      .createIncome({
        name: newIncomeName,
        yearMonth: newIncomeYearMonth,
        amount: newIncomeAmount,
        isActive: newIncomeActive,
        note: newIncomeNote,
      })
      .then(() => refreshAll())
      .then(() => {
        setNewIncomeName("");
        setNewIncomeYearMonth("");
        setNewIncomeAmount(0);
        setNewIncomeNote("");
        setNewIncomeActive(true);
        showNotice("収入を追加しました");
      })
      .catch((e) => showNotice((e as Error).message, true));
  }, [newIncomeName, newIncomeYearMonth, newIncomeAmount, newIncomeActive, newIncomeNote, refreshAll, showNotice]);

  return {
    incomes,
    sortedIncomes,
    incomeDrafts,
    incomeFilterName,
    incomeFilterActive,
    incomeTotal,
    newIncomeName,
    newIncomeYearMonth,
    newIncomeAmount,
    newIncomeActive,
    newIncomeNote,
    loadIncomes,
    incomeSortMark,
    onToggleIncomeSort,
    onChangeIncomeFilterName: setIncomeFilterName,
    onChangeIncomeFilterActive: setIncomeFilterActive,
    onSearch,
    onClear,
    onChangeIncomeDraft: (id: number, patch: Partial<IncomeDraft>) => setIncomeDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })),
    onSave,
    onDelete,
    onChangeNewIncomeName: setNewIncomeName,
    onChangeNewIncomeYearMonth: setNewIncomeYearMonth,
    onChangeNewIncomeAmount: setNewIncomeAmount,
    onChangeNewIncomeActive: setNewIncomeActive,
    onChangeNewIncomeNote: setNewIncomeNote,
    onCreate,
  };
}
