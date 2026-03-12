import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Category, ClassificationRule, UncategorizedStore } from "@/types/models";
import type { CategoryDraft, RuleDraft, RuleSortKey, SortDirection } from "@/types/ui";

type ShowNotice = (message: string, error?: boolean) => void;

export function useRulesTab(categories: Category[], showNotice: ShowNotice, refreshAll: () => Promise<void>) {
  const [rules, setRules] = useState<ClassificationRule[]>([]);
  const [uncategorizedStores, setUncategorizedStores] = useState<UncategorizedStore[]>([]);
  const [ruleDrafts, setRuleDrafts] = useState<Record<number, RuleDraft>>({});
  const [categoryDrafts, setCategoryDrafts] = useState<Record<number, CategoryDraft>>({});
  const [uncQuickCategory, setUncQuickCategory] = useState<Record<string, number>>({});

  const [ruleFilterText, setRuleFilterText] = useState("");
  const [ruleFilterSourceType, setRuleFilterSourceType] = useState("");
  const [ruleFilterActive, setRuleFilterActive] = useState(false);
  const [ruleSort, setRuleSort] = useState<{ key: RuleSortKey; direction: SortDirection }>({ key: "id", direction: "asc" });

  const [newSourceType, setNewSourceType] = useState("");
  const [newProviderName, setNewProviderName] = useState("");
  const [newDirection, setNewDirection] = useState("");
  const [newTransactionType, setNewTransactionType] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newMatchText, setNewMatchText] = useState("");
  const [newCategoryId, setNewCategoryId] = useState<number>(0);
  const [newPriority, setNewPriority] = useState(100);
  const [newActive, setNewActive] = useState(true);
  const [uncStore, setUncStore] = useState("");

  useEffect(() => {
    if (categories.length > 0 && newCategoryId === 0) {
      setNewCategoryId(categories[0].id);
    }
  }, [categories, newCategoryId]);

  useEffect(() => {
    setCategoryDrafts((prev) => {
      const next: Record<number, CategoryDraft> = {};
      for (const category of categories) {
        next[category.id] = prev[category.id] ?? { name: category.name };
      }
      return next;
    });
  }, [categories]);

  const loadRules = useCallback(async (useActiveFilter = true) => {
    const q = new URLSearchParams();
    if (ruleFilterText.trim()) q.set("matchText", ruleFilterText.trim());
    if (ruleFilterSourceType.trim()) q.set("sourceType", ruleFilterSourceType.trim());
    if (useActiveFilter && ruleFilterActive) q.set("active", "true");

    const data = await api.classificationRules(q);
    setRules(data);

    const drafts: Record<number, RuleDraft> = {};
    for (const row of data) {
      drafts[row.id] = {
        sourceType: row.sourceType,
        providerName: row.providerName,
        direction: row.direction,
        transactionType: row.transactionType,
        matchText: row.matchText,
        categoryId: row.categoryId,
        priority: row.priority,
        isActive: row.isActive,
      };
    }
    setRuleDrafts(drafts);
  }, [ruleFilterText, ruleFilterSourceType, ruleFilterActive]);

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
    // refreshAll経由では無効ルールも残して表示する
    await Promise.all([loadRules(false), loadUncategorizedStores()]);
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
        case "sourceType":
          result = `${a.sourceType}/${a.providerName}`.localeCompare(`${b.sourceType}/${b.providerName}`, "ja");
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
    void loadRules(true).catch((e) => showNotice((e as Error).message, true));
  }, [loadRules, showNotice]);

  const onClearRules = useCallback(() => {
    setRuleFilterText("");
    setRuleFilterSourceType("");
    setRuleFilterActive(false);
    void loadRules(true).catch((e) => showNotice((e as Error).message, true));
  }, [loadRules, showNotice]);

  const onSaveRule = useCallback((id: number) => {
    const draft = ruleDrafts[id];
    if (!draft) return;
    void api
      .updateClassificationRule(id, draft)
      .then(() => refreshAll())
      .then(() => loadRules(false))
      .then(() => showNotice(`ルール更新: #${id}`))
      .catch((e) => showNotice((e as Error).message, true));
  }, [ruleDrafts, refreshAll, loadRules, showNotice]);

  const onDeleteRule = useCallback((id: number) => {
    void api
      .deleteClassificationRule(id)
      .then(() => refreshAll())
      .then(() => showNotice(`ルール削除: #${id}`))
      .catch((e) => showNotice((e as Error).message, true));
  }, [refreshAll, showNotice]);

  const onCreateRule = useCallback(() => {
    void api
      .createClassificationRule({
        sourceType: newSourceType,
        providerName: newProviderName,
        direction: newDirection,
        transactionType: newTransactionType,
        matchText: newMatchText,
        categoryId: newCategoryId,
        priority: newPriority,
        isActive: newActive,
      })
      .then(() => refreshAll())
      .then(() => {
        setNewSourceType("");
        setNewProviderName("");
        setNewDirection("");
        setNewTransactionType("");
        setNewMatchText("");
        setNewPriority(100);
        showNotice("ルールを追加しました");
      })
      .catch((e) => showNotice((e as Error).message, true));
  }, [newSourceType, newProviderName, newDirection, newTransactionType, newMatchText, newCategoryId, newPriority, newActive, refreshAll, showNotice]);

  const onSearchUncategorized = useCallback(() => {
    void loadUncategorizedStores().catch((e) => showNotice((e as Error).message, true));
  }, [loadUncategorizedStores, showNotice]);

  const onClearUncategorized = useCallback(() => {
    setUncStore("");
    void loadUncategorizedStores().catch((e) => showNotice((e as Error).message, true));
  }, [loadUncategorizedStores, showNotice]);

  const onCreateRuleFromUncategorized = useCallback((storeName: string) => {
    void api
      .createClassificationRule({
        sourceType: "",
        providerName: "",
        direction: "",
        transactionType: "",
        matchText: storeName,
        categoryId: uncQuickCategory[storeName] ?? categories[0]?.id ?? 0,
        priority: 100,
        isActive: true,
      })
      .then(() => refreshAll())
      .then(() => showNotice(`未分類から追加: ${storeName}`))
      .catch((e) => showNotice((e as Error).message, true));
  }, [uncQuickCategory, categories, refreshAll, showNotice]);

  const onCreateCategory = useCallback(() => {
    void api
      .createCategory({ name: newCategoryName })
      .then(() => refreshAll())
      .then(() => {
        setNewCategoryName("");
        showNotice("カテゴリを追加しました");
      })
      .catch((e) => showNotice((e as Error).message, true));
  }, [newCategoryName, refreshAll, showNotice]);

  const onSaveCategory = useCallback((id: number) => {
    const draft = categoryDrafts[id];
    if (!draft) return;
    void api
      .updateCategory(id, draft)
      .then(() => refreshAll())
      .then(() => showNotice(`カテゴリ更新: #${id}`))
      .catch((e) => showNotice((e as Error).message, true));
  }, [categoryDrafts, refreshAll, showNotice]);

  const onDeleteCategory = useCallback((id: number) => {
    void api
      .deleteCategory(id)
      .then(() => refreshAll())
      .then(() => showNotice(`カテゴリ削除: #${id}`))
      .catch((e) => showNotice((e as Error).message, true));
  }, [refreshAll, showNotice]);

  return {
    rules,
    sortedRules,
    ruleDrafts,
    categoryDrafts,
    uncategorizedStores,
    uncQuickCategory,
    ruleFilterText,
    ruleFilterSourceType,
    ruleFilterActive,
    newSourceType,
    newProviderName,
    newDirection,
    newTransactionType,
    newCategoryName,
    newMatchText,
    newCategoryId,
    newPriority,
    newActive,
    uncStore,
    loadRulesTab,
    ruleSortMark,
    onToggleRuleSort,
    onChangeRuleFilterText: setRuleFilterText,
    onChangeRuleFilterSourceType: setRuleFilterSourceType,
    onChangeRuleFilterActive: setRuleFilterActive,
    onSearchRules,
    onClearRules,
    onChangeRuleDraft: (id: number, patch: Partial<RuleDraft>) => setRuleDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })),
    onSaveRule,
    onDeleteRule,
    onChangeNewSourceType: setNewSourceType,
    onChangeNewProviderName: setNewProviderName,
    onChangeNewDirection: setNewDirection,
    onChangeNewTransactionType: setNewTransactionType,
    onChangeNewCategoryName: setNewCategoryName,
    onChangeNewMatchText: setNewMatchText,
    onChangeNewCategoryId: setNewCategoryId,
    onChangeNewPriority: setNewPriority,
    onChangeNewActive: setNewActive,
    onCreateRule,
    onCreateCategory,
    onChangeCategoryDraft: (id: number, patch: Partial<CategoryDraft>) =>
      setCategoryDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })),
    onSaveCategory,
    onDeleteCategory,
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
