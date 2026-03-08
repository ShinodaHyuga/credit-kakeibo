import type { Category, Transaction } from "@/types/models";
import type { TransactionSortKey } from "@/types/ui";

type Props = {
  transactions: Transaction[];
  sortedTransactions: Transaction[];
  categories: Category[];
  txQuickCategory: Record<number, number>;
  txMonths: string;
  txStore: string;
  txAll: boolean;
  txUncategorized: boolean;
  sortMark: (key: TransactionSortKey) => string;
  onToggleSort: (key: TransactionSortKey) => void;
  onChangeQuickCategory: (id: number, categoryId: number) => void;
  onCreateRule: (tx: Transaction) => void;
  onChangeTxMonths: (value: string) => void;
  onChangeTxStore: (value: string) => void;
  onChangeTxAll: (value: boolean) => void;
  onChangeTxUncategorized: (value: boolean) => void;
  onSearch: () => void;
  onClear: () => void;
  formatMoney: (v: number) => string;
};

export function TransactionsTab(props: Props) {
  return (
    <section className="panel active">
      <div className="section-head">
        <h3>明細一覧</h3>
        <span className="badge">{props.transactions.length.toLocaleString("ja-JP")} 件</span>
      </div>
      <div className="controls">
        <input value={props.txMonths} onChange={(e) => props.onChangeTxMonths(e.target.value)} placeholder="months: 2026-01,2026-02" />
        <input value={props.txStore} onChange={(e) => props.onChangeTxStore(e.target.value)} placeholder="店舗名検索" />
        <label>
          <input type="checkbox" checked={props.txAll} onChange={(e) => props.onChangeTxAll(e.target.checked)} /> 全件表示
        </label>
        <label>
          <input
            type="checkbox"
            checked={props.txUncategorized}
            onChange={(e) => props.onChangeTxUncategorized(e.target.checked)}
          />
          未分類のみ
        </label>
        <button onClick={props.onSearch}>検索</button>
        <button className="ghost" onClick={props.onClear}>
          クリア
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th className="sortable" onClick={() => props.onToggleSort("useDate")}>
              利用日{props.sortMark("useDate")}
            </th>
            <th className="sortable" onClick={() => props.onToggleSort("storeName")}>
              利用店名{props.sortMark("storeName")}
            </th>
            <th className="sortable" onClick={() => props.onToggleSort("category")}>
              カテゴリ{props.sortMark("category")}
            </th>
            <th className="sortable" onClick={() => props.onToggleSort("amount")}>
              利用金額{props.sortMark("amount")}
            </th>
            <th className="sortable" onClick={() => props.onToggleSort("appliedRuleId")}>
              適用ルールID{props.sortMark("appliedRuleId")}
            </th>
            <th>クイックルール作成</th>
          </tr>
        </thead>
        <tbody>
          {props.sortedTransactions.map((tx) => (
            <tr key={tx.id}>
              <td>{tx.useDate}</td>
              <td>{tx.storeName}</td>
              <td className={tx.category === "未分類" ? "uncategorized" : ""}>{tx.category}</td>
              <td className="num">{props.formatMoney(tx.amount)}</td>
              <td>{tx.appliedRuleId ?? "-"}</td>
              <td>
                <select
                  value={props.txQuickCategory[tx.id] ?? 0}
                  onChange={(e) => props.onChangeQuickCategory(tx.id, Number(e.target.value))}
                >
                  {props.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => props.onCreateRule(tx)}>作成</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
