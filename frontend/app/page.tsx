"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RulesTab } from "@/components/tabs/RulesTab";
import { SummaryTab } from "@/components/tabs/SummaryTab";
import { TransactionsTab } from "@/components/tabs/TransactionsTab";
import { useRulesTab } from "@/hooks/useRulesTab";
import { useSummaryTab } from "@/hooks/useSummaryTab";
import { useTransactionsTab } from "@/hooks/useTransactionsTab";
import { api } from "@/lib/api";
import type { Category } from "@/types/models";

type Tab = "transactions" | "summary" | "rules";

function formatMoney(v: number): string {
  return Number(v).toLocaleString("ja-JP");
}

export default function Page() {
  const [activeTab, setActiveTab] = useState<Tab>("transactions");
  const [categories, setCategories] = useState<Category[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [importResult, setImportResult] = useState("");
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const showNotice = useCallback((message: string, error = false) => {
    setNotice({ message, error });
    window.setTimeout(() => setNotice(null), 2600);
  }, []);

  const refreshAllRef = useRef<() => Promise<void>>(async () => undefined);
  const requestRefreshAll = useCallback(() => refreshAllRef.current(), []);

  const transactionsTab = useTransactionsTab(categories, showNotice, requestRefreshAll);
  const summaryTab = useSummaryTab(showNotice);
  const rulesTab = useRulesTab(categories, showNotice, requestRefreshAll);

  const { loadTransactions } = transactionsTab;
  const { loadSummary } = summaryTab;
  const { loadRulesTab } = rulesTab;

  const loadCategories = useCallback(async () => {
    const data = await api.categories();
    setCategories(data);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadTransactions(), loadSummary(), loadRulesTab()]);
  }, [loadTransactions, loadSummary, loadRulesTab]);

  useEffect(() => {
    refreshAllRef.current = refreshAll;
  }, [refreshAll]);

  const reloadImport = useCallback(async () => {
    setBusy(true);
    try {
      const result = await api.reloadImport();
      setImportResult(`対象:${result.totalFiles} 成功:${result.successFiles} 失敗:${result.failedFiles}`);
      await refreshAll();
      showNotice("CSV再読み込みが完了しました");
    } catch (e) {
      showNotice((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }, [refreshAll, showNotice]);

  useEffect(() => {
    void loadCategories().catch((e) => showNotice((e as Error).message, true));
  }, [loadCategories, showNotice]);

  useEffect(() => {
    if (categories.length === 0 || initialized) return;
    setInitialized(true);
    void reloadImport();
  }, [categories, initialized, reloadImport]);

  const categoryNames = useMemo(
    () => Array.from(new Set(categories.map((c) => c.name).filter((name) => name !== "未分類" && name !== "振込"))),
    [categories],
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="title-block">
          <p className="eyebrow">Credit Kakeibo</p>
          <h1>収支管理ダッシュボード</h1>
          <p className="subtitle">Next.js UI / Go API / SQLite</p>
        </div>
        <div className="header-actions">
          <button onClick={() => void reloadImport()} disabled={busy}>
            {busy ? "取込中..." : "CSV再読み込み"}
          </button>
          <span className="muted">{importResult}</span>
        </div>
      </header>

      <nav className="tabs">
        <button className={`tab ${activeTab === "transactions" ? "active" : ""}`} onClick={() => setActiveTab("transactions")}>
          明細一覧
        </button>
        <button className={`tab ${activeTab === "summary" ? "active" : ""}`} onClick={() => setActiveTab("summary")}>
          収支
        </button>
        <button className={`tab ${activeTab === "rules" ? "active" : ""}`} onClick={() => setActiveTab("rules")}>
          カテゴリ管理
        </button>
      </nav>

      <main className="content">
        {activeTab === "transactions" && (
          <TransactionsTab
            transactions={transactionsTab.transactions}
            sortedTransactions={transactionsTab.sortedTransactions}
            categories={categories}
            txQuickCategory={transactionsTab.txQuickCategory}
            txMonths={transactionsTab.txMonths}
            txStore={transactionsTab.txStore}
            txAll={transactionsTab.txAll}
            txUncategorized={transactionsTab.txUncategorized}
            sortMark={transactionsTab.sortMark}
            onToggleSort={transactionsTab.onToggleSort}
            onChangeQuickCategory={transactionsTab.onChangeQuickCategory}
            onCreateRule={transactionsTab.onCreateRule}
            onChangeTxMonths={transactionsTab.onChangeTxMonths}
            onChangeTxStore={transactionsTab.onChangeTxStore}
            onChangeTxAll={transactionsTab.onChangeTxAll}
            onChangeTxUncategorized={transactionsTab.onChangeTxUncategorized}
            onSearch={transactionsTab.onSearch}
            onClear={transactionsTab.onClear}
            formatMoney={formatMoney}
          />
        )}

        {activeTab === "summary" && (
          <SummaryTab
            summaries={summaryTab.summaries}
            categoryNames={categoryNames}
            sumMonths={summaryTab.sumMonths}
            onChangeSumMonths={summaryTab.onChangeSumMonths}
            onSearch={summaryTab.onSearch}
            onClear={summaryTab.onClear}
            formatMoney={formatMoney}
          />
        )}
        {activeTab === "rules" && (
          <RulesTab
            rules={rulesTab.rules}
            sortedRules={rulesTab.sortedRules}
            ruleDrafts={rulesTab.ruleDrafts}
            categories={categories}
            uncategorizedStores={rulesTab.uncategorizedStores}
            uncQuickCategory={rulesTab.uncQuickCategory}
            ruleFilterText={rulesTab.ruleFilterText}
            ruleFilterActive={rulesTab.ruleFilterActive}
            newMatchText={rulesTab.newMatchText}
            newCategoryId={rulesTab.newCategoryId}
            newActive={rulesTab.newActive}
            uncStore={rulesTab.uncStore}
            ruleSortMark={rulesTab.ruleSortMark}
            onToggleRuleSort={rulesTab.onToggleRuleSort}
            onChangeRuleFilterText={rulesTab.onChangeRuleFilterText}
            onChangeRuleFilterActive={rulesTab.onChangeRuleFilterActive}
            onSearchRules={rulesTab.onSearchRules}
            onClearRules={rulesTab.onClearRules}
            onChangeRuleDraft={rulesTab.onChangeRuleDraft}
            onSaveRule={rulesTab.onSaveRule}
            onDeleteRule={rulesTab.onDeleteRule}
            onChangeNewMatchText={rulesTab.onChangeNewMatchText}
            onChangeNewCategoryId={rulesTab.onChangeNewCategoryId}
            onChangeNewActive={rulesTab.onChangeNewActive}
            onCreateRule={rulesTab.onCreateRule}
            onChangeUncStore={rulesTab.onChangeUncStore}
            onSearchUncategorized={rulesTab.onSearchUncategorized}
            onClearUncategorized={rulesTab.onClearUncategorized}
            onChangeUncQuickCategory={rulesTab.onChangeUncQuickCategory}
            onCreateRuleFromUncategorized={rulesTab.onCreateRuleFromUncategorized}
          />
        )}
      </main>

      {notice ? <div className={`notice ${notice.error ? "error" : ""}`}>{notice.message}</div> : null}
    </div>
  );
}
