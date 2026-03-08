import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Category, FixedExpense } from "@/types/models";
import type { FixedExpenseDraft, FixedSortKey, SortDirection } from "@/types/ui";

type ShowNotice = (message: string, error?: boolean) => void;

export function useFixedExpensesTab(categories: Category[], showNotice: ShowNotice, refreshAll: () => Promise<void>) {
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [fixedDrafts, setFixedDrafts] = useState<Record<number, FixedExpenseDraft>>({});

  const [fixedFilterName, setFixedFilterName] = useState("");
  const [fixedFilterActive, setFixedFilterActive] = useState(true);
  const [fixedSort, setFixedSort] = useState<{ key: FixedSortKey; direction: SortDirection }>({
    key: "id",
    direction: "asc",
  });

  const [newFixedName, setNewFixedName] = useState("");
  const [newFixedYearMonth, setNewFixedYearMonth] = useState("");
  const [newFixedCategoryID, setNewFixedCategoryID] = useState<number>(0);
  const [newFixedAmount, setNewFixedAmount] = useState<number>(0);
  const [newFixedActive, setNewFixedActive] = useState(true);
  const [newFixedNote, setNewFixedNote] = useState("");

  useEffect(() => {
    if (categories.length > 0 && newFixedCategoryID === 0) {
      setNewFixedCategoryID(categories[0].id);
    }
  }, [categories, newFixedCategoryID]);

  const loadFixedExpenses = useCallback(async () => {
    const q = new URLSearchParams();
    if (fixedFilterName.trim()) q.set("name", fixedFilterName.trim());
    if (fixedFilterActive) q.set("active", "true");

    const data = await api.fixedExpenses(q);
    setFixedExpenses(data);

    const drafts: Record<number, FixedExpenseDraft> = {};
    for (const row of data) {
      drafts[row.id] = {
        name: row.name,
        yearMonth: row.yearMonth,
        categoryId: row.categoryId,
        amount: row.amount,
        isActive: row.isActive,
        note: row.note,
      };
    }
    setFixedDrafts(drafts);
  }, [fixedFilterName, fixedFilterActive]);

  const sortedFixedExpenses = useMemo(() => {
    const list = [...fixedExpenses];
    list.sort((a, b) => {
      let result = 0;
      switch (fixedSort.key) {
        case "id":
          result = a.id - b.id;
          break;
        case "name":
          result = a.name.localeCompare(b.name, "ja");
          break;
        case "yearMonth":
          result = a.yearMonth.localeCompare(b.yearMonth);
          break;
        case "category":
          result = a.category.localeCompare(b.category, "ja");
          break;
        case "amount":
          result = a.amount - b.amount;
          break;
      }
      return fixedSort.direction === "asc" ? result : -result;
    });
    return list;
  }, [fixedExpenses, fixedSort]);

  const fixedTotal = useMemo(() => fixedExpenses.reduce((sum, row) => sum + row.amount, 0), [fixedExpenses]);

  const fixedSortMark = useCallback((key: FixedSortKey) => {
    if (fixedSort.key !== key) return "";
    return fixedSort.direction === "asc" ? " ▲" : " ▼";
  }, [fixedSort]);

  const onToggleFixedSort = useCallback((key: FixedSortKey) => {
    setFixedSort((prev) => (prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
  }, []);

  const onSearch = useCallback(() => {
    void loadFixedExpenses().catch((e) => showNotice((e as Error).message, true));
  }, [loadFixedExpenses, showNotice]);

  const onClear = useCallback(() => {
    setFixedFilterName("");
    setFixedFilterActive(true);
    void loadFixedExpenses().catch((e) => showNotice((e as Error).message, true));
  }, [loadFixedExpenses, showNotice]);

  const onSave = useCallback((id: number) => {
    const draft = fixedDrafts[id];
    if (!draft) return;
    void api
      .updateFixedExpense(id, draft)
      .then(() => refreshAll())
      .then(() => showNotice(`固定支出更新: #${id}`))
      .catch((e) => showNotice((e as Error).message, true));
  }, [fixedDrafts, refreshAll, showNotice]);

  const onDelete = useCallback((id: number) => {
    void api
      .deleteFixedExpense(id)
      .then(() => refreshAll())
      .then(() => showNotice(`固定支出削除: #${id}`))
      .catch((e) => showNotice((e as Error).message, true));
  }, [refreshAll, showNotice]);

  const onCreate = useCallback(() => {
    void api
      .createFixedExpense({
        name: newFixedName,
        yearMonth: newFixedYearMonth,
        categoryId: newFixedCategoryID,
        amount: newFixedAmount,
        isActive: newFixedActive,
        note: newFixedNote,
      })
      .then(() => refreshAll())
      .then(() => {
        setNewFixedName("");
        setNewFixedYearMonth("");
        setNewFixedAmount(0);
        setNewFixedNote("");
        setNewFixedActive(true);
        showNotice("固定支出を追加しました");
      })
      .catch((e) => showNotice((e as Error).message, true));
  }, [newFixedName, newFixedYearMonth, newFixedCategoryID, newFixedAmount, newFixedActive, newFixedNote, refreshAll, showNotice]);

  return {
    fixedExpenses,
    sortedFixedExpenses,
    fixedDrafts,
    fixedFilterName,
    fixedFilterActive,
    fixedTotal,
    newFixedName,
    newFixedYearMonth,
    newFixedCategoryID,
    newFixedAmount,
    newFixedActive,
    newFixedNote,
    loadFixedExpenses,
    fixedSortMark,
    onToggleFixedSort,
    onChangeFixedFilterName: setFixedFilterName,
    onChangeFixedFilterActive: setFixedFilterActive,
    onSearch,
    onClear,
    onChangeFixedDraft: (id: number, patch: Partial<FixedExpenseDraft>) => setFixedDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })),
    onSave,
    onDelete,
    onChangeNewFixedName: setNewFixedName,
    onChangeNewFixedYearMonth: setNewFixedYearMonth,
    onChangeNewFixedCategoryID: setNewFixedCategoryID,
    onChangeNewFixedAmount: setNewFixedAmount,
    onChangeNewFixedActive: setNewFixedActive,
    onChangeNewFixedNote: setNewFixedNote,
    onCreate,
  };
}
