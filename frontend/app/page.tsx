"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type {
  Category,
  CategoryRule,
  FixedExpense,
  MonthlySummary,
  Transaction,
  UncategorizedStore,
} from "@/types/models";

type Tab = "transactions" | "summary" | "rules" | "fixed";

type RuleDraft = {
  matchText: string;
  categoryId: number;
  isActive: boolean;
};

type FixedExpenseDraft = {
  name: string;
  yearMonth: string;
  categoryId: number;
  amount: number;
  isActive: boolean;
  note: string;
};

function formatMoney(v: number): string {
  return Number(v).toLocaleString("ja-JP");
}

export default function Page() {
  const [activeTab, setActiveTab] = useState<Tab>("transactions");

  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [uncategorizedStores, setUncategorizedStores] = useState<UncategorizedStore[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);

  const [ruleDrafts, setRuleDrafts] = useState<Record<number, RuleDraft>>({});
  const [fixedDrafts, setFixedDrafts] = useState<Record<number, FixedExpenseDraft>>({});
  const [txQuickCategory, setTxQuickCategory] = useState<Record<number, number>>({});
  const [uncQuickCategory, setUncQuickCategory] = useState<Record<string, number>>({});

  const [txMonths, setTxMonths] = useState("");
  const [txStore, setTxStore] = useState("");
  const [txAll, setTxAll] = useState(false);
  const [txUncategorized, setTxUncategorized] = useState(false);

  const [sumMonths, setSumMonths] = useState("");

  const [ruleFilterText, setRuleFilterText] = useState("");
  const [ruleFilterActive, setRuleFilterActive] = useState(true);

  const [newMatchText, setNewMatchText] = useState("");
  const [newCategoryId, setNewCategoryId] = useState<number>(0);
  const [newActive, setNewActive] = useState(true);

  const [uncStore, setUncStore] = useState("");

  const [fixedFilterName, setFixedFilterName] = useState("");
  const [fixedFilterActive, setFixedFilterActive] = useState(true);
  const [newFixedName, setNewFixedName] = useState("");
  const [newFixedYearMonth, setNewFixedYearMonth] = useState("");
  const [newFixedCategoryID, setNewFixedCategoryID] = useState<number>(0);
  const [newFixedAmount, setNewFixedAmount] = useState<number>(0);
  const [newFixedActive, setNewFixedActive] = useState(true);
  const [newFixedNote, setNewFixedNote] = useState("");

  const [importResult, setImportResult] = useState("");
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const showNotice = useCallback((message: string, error = false) => {
    setNotice({ message, error });
    window.setTimeout(() => {
      setNotice(null);
    }, 2600);
  }, []);

  const loadCategories = useCallback(async () => {
    const data = await api.categories();
    setCategories(data);
    if (data.length > 0 && newCategoryId === 0) {
      setNewCategoryId(data[0].id);
    }
    if (data.length > 0 && newFixedCategoryID === 0) {
      setNewFixedCategoryID(data[0].id);
    }
  }, [newCategoryId, newFixedCategoryID]);

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
  }, [txAll, txMonths, txStore, txUncategorized, categories]);

  const loadSummary = useCallback(async () => {
    const q = new URLSearchParams();
    if (sumMonths.trim()) q.set("months", sumMonths.trim());
    const data = await api.summaryMonthly(q);
    setSummaries(data);
  }, [sumMonths]);

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
  }, [ruleFilterActive, ruleFilterText]);

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
  }, [fixedFilterActive, fixedFilterName]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadTransactions(), loadSummary(), loadRules(), loadUncategorizedStores(), loadFixedExpenses()]);
  }, [loadTransactions, loadSummary, loadRules, loadUncategorizedStores, loadFixedExpenses]);

  const reloadImport = useCallback(async () => {
    setBusy(true);
    try {
      const result = await api.reloadImport();
      setImportResult(`対象:${result.totalFiles} 成功:${result.successFiles} 失敗:${result.failedFiles}`);
      showNotice("CSV再読み込みが完了しました");
      await refreshAll();
    } catch (e) {
      showNotice((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }, [refreshAll, showNotice]);

  const addRule = useCallback(
    async (matchText: string, categoryId: number, isActive: boolean) => {
      await api.createCategoryRule({ matchText, categoryId, isActive });
      await refreshAll();
    },
    [refreshAll],
  );

  useEffect(() => {
    const boot = async () => {
      setBusy(true);
      try {
        await loadCategories();
      } catch (e) {
        showNotice((e as Error).message, true);
      } finally {
        setBusy(false);
      }
    };
    void boot();
  }, [loadCategories, showNotice]);

  useEffect(() => {
    if (categories.length === 0) return;
    void reloadImport();
  }, [categories, reloadImport]);

  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories]);
  const fixedTotal = useMemo(() => fixedExpenses.reduce((sum, row) => sum + row.amount, 0), [fixedExpenses]);

  return (
    <div className="app">
      <header>
        <div>
          <h1>支出管理アプリ</h1>
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
          支出
        </button>
        <button className={`tab ${activeTab === "rules" ? "active" : ""}`} onClick={() => setActiveTab("rules")}>
          カテゴリ管理
        </button>
        <button className={`tab ${activeTab === "fixed" ? "active" : ""}`} onClick={() => setActiveTab("fixed")}>
          固定支出
        </button>
      </nav>

      <main>
        <section className={`panel ${activeTab === "transactions" ? "active" : ""}`}>
          <div className="section-head">
            <h3>明細一覧</h3>
            <span className="badge">{transactions.length.toLocaleString("ja-JP")} 件</span>
          </div>
          <div className="controls">
            <input value={txMonths} onChange={(e) => setTxMonths(e.target.value)} placeholder="months: 2026-01,2026-02" />
            <input value={txStore} onChange={(e) => setTxStore(e.target.value)} placeholder="店舗名検索" />
            <label>
              <input type="checkbox" checked={txAll} onChange={(e) => setTxAll(e.target.checked)} /> 全件表示
            </label>
            <label>
              <input type="checkbox" checked={txUncategorized} onChange={(e) => setTxUncategorized(e.target.checked)} /> 未分類のみ
            </label>
            <button onClick={() => void loadTransactions().catch((e) => showNotice(e.message, true))}>検索</button>
            <button
              className="ghost"
              onClick={() => {
                setTxMonths("");
                setTxStore("");
                setTxAll(false);
                setTxUncategorized(false);
                void loadTransactions().catch((e) => showNotice(e.message, true));
              }}
            >
              クリア
            </button>
          </div>

          <table>
            <thead>
              <tr>
                <th>利用日</th>
                <th>利用店名</th>
                <th>カテゴリ</th>
                <th>利用金額</th>
                <th>適用ルールID</th>
                <th>クイックルール作成</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{tx.useDate}</td>
                  <td>{tx.storeName}</td>
                  <td className={tx.category === "未分類" ? "uncategorized" : ""}>{tx.category}</td>
                  <td className="num">{formatMoney(tx.amount)}</td>
                  <td>{tx.appliedRuleId ?? "-"}</td>
                  <td>
                    <select
                      value={txQuickCategory[tx.id] ?? 0}
                      onChange={(e) => setTxQuickCategory((prev) => ({ ...prev, [tx.id]: Number(e.target.value) }))}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        void addRule(tx.storeName, txQuickCategory[tx.id] ?? categories[0]?.id ?? 0, true)
                          .then(() => showNotice(`ルール作成: ${tx.storeName}`))
                          .catch((e) => showNotice(e.message, true));
                      }}
                    >
                      作成
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={`panel ${activeTab === "summary" ? "active" : ""}`}>
          <div className="section-head">
            <h3>支出集計</h3>
            <span className="badge">{summaries.length.toLocaleString("ja-JP")} ヶ月</span>
          </div>
          <div className="controls">
            <input value={sumMonths} onChange={(e) => setSumMonths(e.target.value)} placeholder="months: 2026-01,2026-02" />
            <button onClick={() => void loadSummary().catch((e) => showNotice(e.message, true))}>集計</button>
            <button
              className="ghost"
              onClick={() => {
                setSumMonths("");
                void loadSummary().catch((e) => showNotice(e.message, true));
              }}
            >
              クリア
            </button>
          </div>

          <table className="summary-table">
            <colgroup>
              <col className="col-month" />
              {categoryNames.map((name) => (
                <col key={`col-${name}`} className="col-category" />
              ))}
              <col className="col-total" />
            </colgroup>
            <thead>
              <tr>
                <th>利用年月</th>
                {categoryNames.map((name) => (
                  <th key={name}>{name}</th>
                ))}
                <th>合計</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((row) => (
                <tr key={row.yearMonth}>
                  <td>{row.yearMonth}</td>
                  {categoryNames.map((name) => (
                    <td key={`${row.yearMonth}-${name}`} className="num">
                      {formatMoney(row.categories[name] ?? 0)}
                    </td>
                  ))}
                  <td className="num">{formatMoney(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={`panel ${activeTab === "rules" ? "active" : ""}`}>
          <div className="section-head">
            <h3>判定ルール</h3>
            <span className="badge">{rules.length.toLocaleString("ja-JP")} 件</span>
          </div>
          <div className="controls">
            <input value={ruleFilterText} onChange={(e) => setRuleFilterText(e.target.value)} placeholder="matchText検索" />
            <label>
              <input type="checkbox" checked={ruleFilterActive} onChange={(e) => setRuleFilterActive(e.target.checked)} /> 有効のみ
            </label>
            <button onClick={() => void loadRules().catch((e) => showNotice(e.message, true))}>検索</button>
            <button
              className="ghost"
              onClick={() => {
                setRuleFilterText("");
                setRuleFilterActive(true);
                void loadRules().catch((e) => showNotice(e.message, true));
              }}
            >
              クリア
            </button>
          </div>

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>matchText</th>
                <th>カテゴリ</th>
                <th>有効</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const draft = ruleDrafts[rule.id];
                if (!draft) return null;
                return (
                  <tr key={rule.id}>
                    <td>{rule.id}</td>
                    <td>
                      <input
                        value={draft.matchText}
                        onChange={(e) =>
                          setRuleDrafts((prev) => ({
                            ...prev,
                            [rule.id]: { ...prev[rule.id], matchText: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={draft.categoryId}
                        onChange={(e) =>
                          setRuleDrafts((prev) => ({
                            ...prev,
                            [rule.id]: { ...prev[rule.id], categoryId: Number(e.target.value) },
                          }))
                        }
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        onChange={(e) =>
                          setRuleDrafts((prev) => ({
                            ...prev,
                            [rule.id]: { ...prev[rule.id], isActive: e.target.checked },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => {
                          void api
                            .updateCategoryRule(rule.id, {
                              matchText: draft.matchText,
                              categoryId: draft.categoryId,
                              isActive: draft.isActive,
                            })
                            .then(() => refreshAll())
                            .then(() => showNotice(`ルール更新: #${rule.id}`))
                            .catch((e) => showNotice(e.message, true));
                        }}
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          void api
                            .deleteCategoryRule(rule.id)
                            .then(() => refreshAll())
                            .then(() => showNotice(`ルール削除: #${rule.id}`))
                            .catch((e) => showNotice(e.message, true));
                        }}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="section-head">
            <h3>新規ルール追加</h3>
          </div>
          <div className="controls">
            <input value={newMatchText} onChange={(e) => setNewMatchText(e.target.value)} placeholder="matchText" />
            <select value={newCategoryId} onChange={(e) => setNewCategoryId(Number(e.target.value))}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label>
              <input type="checkbox" checked={newActive} onChange={(e) => setNewActive(e.target.checked)} /> 有効
            </label>
            <button
              onClick={() => {
                void addRule(newMatchText, newCategoryId, newActive)
                  .then(() => {
                    setNewMatchText("");
                    showNotice("ルールを追加しました");
                  })
                  .catch((e) => showNotice(e.message, true));
              }}
            >
              追加
            </button>
          </div>

          <div className="section-head">
            <h3>未分類店舗</h3>
            <span className="badge danger">{uncategorizedStores.length.toLocaleString("ja-JP")} 件</span>
          </div>
          <div className="controls">
            <input value={uncStore} onChange={(e) => setUncStore(e.target.value)} placeholder="店舗名検索" />
            <button onClick={() => void loadUncategorizedStores().catch((e) => showNotice(e.message, true))}>検索</button>
            <button
              className="ghost"
              onClick={() => {
                setUncStore("");
                void loadUncategorizedStores().catch((e) => showNotice(e.message, true));
              }}
            >
              クリア
            </button>
          </div>

          <table>
            <thead>
              <tr>
                <th>店舗名</th>
                <th>クイック追加</th>
              </tr>
            </thead>
            <tbody>
              {uncategorizedStores.map((store) => (
                <tr key={store.storeName}>
                  <td className="uncategorized">{store.storeName}</td>
                  <td>
                    <select
                      value={uncQuickCategory[store.storeName] ?? categories[0]?.id ?? 0}
                      onChange={(e) =>
                        setUncQuickCategory((prev) => ({
                          ...prev,
                          [store.storeName]: Number(e.target.value),
                        }))
                      }
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        void addRule(store.storeName, uncQuickCategory[store.storeName] ?? categories[0]?.id ?? 0, true)
                          .then(() => showNotice(`未分類から追加: ${store.storeName}`))
                          .catch((e) => showNotice(e.message, true));
                      }}
                    >
                      追加
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={`panel ${activeTab === "fixed" ? "active" : ""}`}>
          <div className="section-head">
            <h3>固定支出</h3>
            <span className="badge">{fixedExpenses.length.toLocaleString("ja-JP")} 件</span>
          </div>
          <div className="controls">
            <input value={fixedFilterName} onChange={(e) => setFixedFilterName(e.target.value)} placeholder="支出名検索" />
            <label>
              <input
                type="checkbox"
                checked={fixedFilterActive}
                onChange={(e) => setFixedFilterActive(e.target.checked)}
              />
              有効のみ
            </label>
            <button onClick={() => void loadFixedExpenses().catch((e) => showNotice(e.message, true))}>検索</button>
            <button
              className="ghost"
              onClick={() => {
                setFixedFilterName("");
                setFixedFilterActive(true);
                void loadFixedExpenses().catch((e) => showNotice(e.message, true));
              }}
            >
              クリア
            </button>
            <span className="badge">合計 {formatMoney(fixedTotal)} 円</span>
          </div>

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>支出名</th>
                <th>利用年月</th>
                <th>カテゴリ</th>
                <th>金額</th>
                <th>有効</th>
                <th>メモ</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {fixedExpenses.map((row) => {
                const draft = fixedDrafts[row.id];
                if (!draft) return null;
                return (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>
                      <input
                        value={draft.name}
                        onChange={(e) =>
                          setFixedDrafts((prev) => ({
                            ...prev,
                            [row.id]: { ...prev[row.id], name: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={draft.yearMonth}
                        onChange={(e) =>
                          setFixedDrafts((prev) => ({
                            ...prev,
                            [row.id]: { ...prev[row.id], yearMonth: e.target.value },
                          }))
                        }
                        placeholder="YYYY-MM"
                      />
                    </td>
                    <td>
                      <select
                        value={draft.categoryId}
                        onChange={(e) =>
                          setFixedDrafts((prev) => ({
                            ...prev,
                            [row.id]: { ...prev[row.id], categoryId: Number(e.target.value) },
                          }))
                        }
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        value={draft.amount}
                        onChange={(e) =>
                          setFixedDrafts((prev) => ({
                            ...prev,
                            [row.id]: { ...prev[row.id], amount: Number(e.target.value) },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        onChange={(e) =>
                          setFixedDrafts((prev) => ({
                            ...prev,
                            [row.id]: { ...prev[row.id], isActive: e.target.checked },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={draft.note}
                        onChange={(e) =>
                          setFixedDrafts((prev) => ({
                            ...prev,
                            [row.id]: { ...prev[row.id], note: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => {
                          void api
                            .updateFixedExpense(row.id, draft)
                            .then(() => refreshAll())
                            .then(() => showNotice(`固定支出更新: #${row.id}`))
                            .catch((e) => showNotice(e.message, true));
                        }}
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          void api
                            .deleteFixedExpense(row.id)
                            .then(() => refreshAll())
                            .then(() => showNotice(`固定支出削除: #${row.id}`))
                            .catch((e) => showNotice(e.message, true));
                        }}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="section-head">
            <h3>新規固定支出追加</h3>
          </div>
          <div className="controls">
            <input value={newFixedName} onChange={(e) => setNewFixedName(e.target.value)} placeholder="支出名" />
            <input
              value={newFixedYearMonth}
              onChange={(e) => setNewFixedYearMonth(e.target.value)}
              placeholder="YYYY-MM"
            />
            <select value={newFixedCategoryID} onChange={(e) => setNewFixedCategoryID(Number(e.target.value))}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={newFixedAmount}
              onChange={(e) => setNewFixedAmount(Number(e.target.value))}
              placeholder="金額"
            />
            <label>
              <input type="checkbox" checked={newFixedActive} onChange={(e) => setNewFixedActive(e.target.checked)} /> 有効
            </label>
            <input value={newFixedNote} onChange={(e) => setNewFixedNote(e.target.value)} placeholder="メモ" />
            <button
              onClick={() => {
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
                  .catch((e) => showNotice(e.message, true));
              }}
            >
              追加
            </button>
          </div>
        </section>
      </main>

      {notice ? <div className={`notice ${notice.error ? "error" : ""}`}>{notice.message}</div> : null}
    </div>
  );
}
