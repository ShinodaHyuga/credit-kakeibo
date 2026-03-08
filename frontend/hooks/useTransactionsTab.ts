import { useCallback, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Category, Transaction } from "@/types/models";
import type { SortDirection, TransactionSortKey } from "@/types/ui";

type ShowNotice = (message: string, error?: boolean) => void;

export function useTransactionsTab(categories: Category[], showNotice: ShowNotice, refreshAll: () => Promise<void>) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txQuickCategory, setTxQuickCategory] = useState<Record<number, number>>({});
  const [txMonths, setTxMonths] = useState("");
  const [txStore, setTxStore] = useState("");
  const [txAll, setTxAll] = useState(false);
  const [txUncategorized, setTxUncategorized] = useState(false);
  const [txSort, setTxSort] = useState<{ key: TransactionSortKey; direction: SortDirection }>({
    key: "useDate",
    direction: "desc",
  });

  const loadTransactions = useCallback(async () => {
    const q = new URLSearchParams();
    if (txMonths.trim()) q.set("months", txMonths.trim());
    if (txStore.trim()) q.set("storeName", txStore.trim());
    if (txAll) q.set("all", "true");
    if (txUncategorized) q.set("uncategorized", "true");

    const data = await api.transactions(q);
    setTransactions(data);
    setTxQuickCategory((prev) => {
      const next: Record<number, number> = {};
      for (const tx of data) {
        next[tx.id] = prev[tx.id] ?? categories[0]?.id ?? 0;
      }
      return next;
    });
  }, [txMonths, txStore, txAll, txUncategorized, categories]);

  const sortedTransactions = useMemo(() => {
    const list = [...transactions];
    list.sort((a, b) => {
      let result = 0;
      switch (txSort.key) {
        case "useDate":
          result = a.useDate.localeCompare(b.useDate);
          break;
        case "storeName":
          result = a.storeName.localeCompare(b.storeName, "ja");
          break;
        case "category":
          result = a.category.localeCompare(b.category, "ja");
          break;
        case "amount":
          result = a.amount - b.amount;
          break;
        case "appliedRuleId":
          result = (a.appliedRuleId ?? -1) - (b.appliedRuleId ?? -1);
          break;
      }
      return txSort.direction === "asc" ? result : -result;
    });
    return list;
  }, [transactions, txSort]);

  const sortMark = useCallback((key: TransactionSortKey) => {
    if (txSort.key !== key) return "";
    return txSort.direction === "asc" ? " ▲" : " ▼";
  }, [txSort]);

  const onToggleSort = useCallback((key: TransactionSortKey) => {
    setTxSort((prev) => (prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
  }, []);

  const onSearch = useCallback(() => {
    void loadTransactions().catch((e) => showNotice((e as Error).message, true));
  }, [loadTransactions, showNotice]);

  const onClear = useCallback(() => {
    setTxMonths("");
    setTxStore("");
    setTxAll(false);
    setTxUncategorized(false);
    void loadTransactions().catch((e) => showNotice((e as Error).message, true));
  }, [loadTransactions, showNotice]);

  const onCreateRule = useCallback((tx: Transaction) => {
    void api
      .createCategoryRule({ matchText: tx.storeName, categoryId: txQuickCategory[tx.id] ?? categories[0]?.id ?? 0, isActive: true })
      .then(() => refreshAll())
      .then(() => showNotice(`ルール作成: ${tx.storeName}`))
      .catch((e) => showNotice((e as Error).message, true));
  }, [txQuickCategory, categories, refreshAll, showNotice]);

  return {
    transactions,
    sortedTransactions,
    txQuickCategory,
    txMonths,
    txStore,
    txAll,
    txUncategorized,
    sortMark,
    loadTransactions,
    onToggleSort,
    onChangeQuickCategory: (id: number, categoryId: number) => setTxQuickCategory((prev) => ({ ...prev, [id]: categoryId })),
    onCreateRule,
    onChangeTxMonths: setTxMonths,
    onChangeTxStore: setTxStore,
    onChangeTxAll: setTxAll,
    onChangeTxUncategorized: setTxUncategorized,
    onSearch,
    onClear,
  };
}
