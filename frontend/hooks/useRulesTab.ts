import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Category, CategoryRule, UncategorizedStore } from "@/types/models";
import type { RuleDraft, RuleSortKey, SortDirection } from "@/types/ui";

type ShowNotice = (message: string, error?: boolean) => void;

export function useRulesTab(categories: Category[], showNotice: ShowNotice, refreshAll: () => Promise<void>) {
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [uncategorizedStores, setUncategorizedStores] = useState<UncategorizedStore[]>([]);
  const [ruleDrafts, setRuleDrafts] = useState<Record<number, RuleDraft>>({});
  const [uncQuickCategory, setUncQuickCategory] = useState<Record<string, number>>({});

  const [ruleFilterText, setRuleFilterText] = useState("");
  const [ruleFilterActive, setRuleFilterActive] = useState(true);
  const [ruleSort, setRuleSort] = useState<{ key: RuleSortKey; direction: SortDirection }>({ key: "id", direction: "asc" });

  const [newMatchText, setNewMatchText] = useState("");
  const [newCategoryId, setNewCategoryId] = useState<number>(0);
  const [newActive, setNewActive] = useState(true);
  const [uncStore, setUncStore] = useState("");

  useEffect(() => {
    if (categories.length > 0 && newCategoryId === 0) {
      setNewCategoryId(categories[0].id);
    }
  }, [categories, newCategoryId]);

  const loadRules = useCallback(async () => {
    const q = new URLSearchParams();
    if (ruleFilterText.trim()) q.set("matchText", ruleFilterText.trim());
    if (ruleFilterActive) q.set("active", "true");

    const data = await api.categoryRules(q);
    setRules(data);

    const drafts: Record<number, RuleDraft> = {};
    for (const row of data) {
      drafts[row.id] = {
        matchText: row.matchText,
        categoryId: row.categoryId,
        isActive: row.isActive,
      };
    }
    setRuleDrafts(drafts);
  }, [ruleFilterText, ruleFilterActive]);

  const loadUncategorizedStores = useCallback(async () => {
    const q = new URLSearchParams();
    if (uncStore.trim()) q.set("storeName", uncStore.trim());
    const data = await api.uncategorizedStores(q);
    setUncategorizedStores(data);
    setUncQuickCategory((prev) => {
      const next: Record<string, number> = {};
      for (const row of data) {
        next[row.storeName] = prev[row.storeName] ?? categories[0]?.id ?? 0;
      }
      return next;
    });
  }, [uncStore, categories]);

  const loadRulesTab = useCallback(async () => {
    await Promise.all([loadRules(), loadUncategorizedStores()]);
  }, [loadRules, loadUncategorizedStores]);

  const sortedRules = useMemo(() => {
    const list = [...rules];
    list.sort((a, b) => {
      let result = 0;
      switch (ruleSort.key) {
        case "id":
          result = a.id - b.id;
          break;
        case "matchText":
          result = a.matchText.localeCompare(b.matchText, "ja");
          break;
        case "category":
          result = a.categoryName.localeCompare(b.categoryName, "ja");
          break;
      }
      return ruleSort.direction === "asc" ? result : -result;
    });
    return list;
  }, [rules, ruleSort]);

  const ruleSortMark = useCallback((key: RuleSortKey) => {
    if (ruleSort.key !== key) return "";
    return ruleSort.direction === "asc" ? " ▲" : " ▼";
  }, [ruleSort]);

  const onToggleRuleSort = useCallback((key: RuleSortKey) => {
    setRuleSort((prev) => (prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
  }, []);

  const onSearchRules = useCallback(() => {
    void loadRules().catch((e) => showNotice((e as Error).message, true));
  }, [loadRules, showNotice]);

  const onClearRules = useCallback(() => {
    setRuleFilterText("");
    setRuleFilterActive(true);
    void loadRules().catch((e) => showNotice((e as Error).message, true));
  }, [loadRules, showNotice]);

  const onSaveRule = useCallback((id: number) => {
    const draft = ruleDrafts[id];
    if (!draft) return;
    void api
      .updateCategoryRule(id, draft)
      .then(() => refreshAll())
      .then(() => showNotice(`ルール更新: #${id}`))
      .catch((e) => showNotice((e as Error).message, true));
  }, [ruleDrafts, refreshAll, showNotice]);

  const onDeleteRule = useCallback((id: number) => {
    void api
      .deleteCategoryRule(id)
      .then(() => refreshAll())
      .then(() => showNotice(`ルール削除: #${id}`))
      .catch((e) => showNotice((e as Error).message, true));
  }, [refreshAll, showNotice]);

  const onCreateRule = useCallback(() => {
    void api
      .createCategoryRule({ matchText: newMatchText, categoryId: newCategoryId, isActive: newActive })
      .then(() => refreshAll())
      .then(() => {
        setNewMatchText("");
        showNotice("ルールを追加しました");
      })
      .catch((e) => showNotice((e as Error).message, true));
  }, [newMatchText, newCategoryId, newActive, refreshAll, showNotice]);

  const onSearchUncategorized = useCallback(() => {
    void loadUncategorizedStores().catch((e) => showNotice((e as Error).message, true));
  }, [loadUncategorizedStores, showNotice]);

  const onClearUncategorized = useCallback(() => {
    setUncStore("");
    void loadUncategorizedStores().catch((e) => showNotice((e as Error).message, true));
  }, [loadUncategorizedStores, showNotice]);

  const onCreateRuleFromUncategorized = useCallback((storeName: string) => {
    void api
      .createCategoryRule({
        matchText: storeName,
        categoryId: uncQuickCategory[storeName] ?? categories[0]?.id ?? 0,
        isActive: true,
      })
      .then(() => refreshAll())
      .then(() => showNotice(`未分類から追加: ${storeName}`))
      .catch((e) => showNotice((e as Error).message, true));
  }, [uncQuickCategory, categories, refreshAll, showNotice]);

  return {
    rules,
    sortedRules,
    ruleDrafts,
    uncategorizedStores,
    uncQuickCategory,
    ruleFilterText,
    ruleFilterActive,
    newMatchText,
    newCategoryId,
    newActive,
    uncStore,
    loadRulesTab,
    ruleSortMark,
    onToggleRuleSort,
    onChangeRuleFilterText: setRuleFilterText,
    onChangeRuleFilterActive: setRuleFilterActive,
    onSearchRules,
    onClearRules,
    onChangeRuleDraft: (id: number, patch: Partial<RuleDraft>) => setRuleDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })),
    onSaveRule,
    onDeleteRule,
    onChangeNewMatchText: setNewMatchText,
    onChangeNewCategoryId: setNewCategoryId,
    onChangeNewActive: setNewActive,
    onCreateRule,
    onChangeUncStore: setUncStore,
    onSearchUncategorized,
    onClearUncategorized,
    onChangeUncQuickCategory: (storeName: string, categoryId: number) =>
      setUncQuickCategory((prev) => ({
        ...prev,
        [storeName]: categoryId,
      })),
    onCreateRuleFromUncategorized,
  };
}
