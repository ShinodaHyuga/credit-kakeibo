import type { Category, FixedExpense } from "@/types/models";
import type { FixedExpenseDraft, FixedSortKey } from "@/types/ui";

type Props = {
  fixedExpenses: FixedExpense[];
  sortedFixedExpenses: FixedExpense[];
  fixedDrafts: Record<number, FixedExpenseDraft>;
  categories: Category[];
  fixedFilterName: string;
  fixedFilterActive: boolean;
  fixedTotal: number;
  newFixedName: string;
  newFixedYearMonth: string;
  newFixedCategoryID: number;
  newFixedAmount: number;
  newFixedActive: boolean;
  newFixedNote: string;
  fixedSortMark: (key: FixedSortKey) => string;
  onToggleFixedSort: (key: FixedSortKey) => void;
  onChangeFixedFilterName: (value: string) => void;
  onChangeFixedFilterActive: (value: boolean) => void;
  onSearch: () => void;
  onClear: () => void;
  onChangeFixedDraft: (id: number, patch: Partial<FixedExpenseDraft>) => void;
  onSave: (id: number) => void;
  onDelete: (id: number) => void;
  onChangeNewFixedName: (value: string) => void;
  onChangeNewFixedYearMonth: (value: string) => void;
  onChangeNewFixedCategoryID: (value: number) => void;
  onChangeNewFixedAmount: (value: number) => void;
  onChangeNewFixedActive: (value: boolean) => void;
  onChangeNewFixedNote: (value: string) => void;
  onCreate: () => void;
  formatMoney: (v: number) => string;
};

export function FixedExpensesTab(props: Props) {
  return (
    <section className="panel active">
      <div className="section-head">
        <h3>固定支出</h3>
        <span className="badge">{props.fixedExpenses.length.toLocaleString("ja-JP")} 件</span>
      </div>
      <div className="controls">
        <input value={props.fixedFilterName} onChange={(e) => props.onChangeFixedFilterName(e.target.value)} placeholder="支出名検索" />
        <label>
          <input
            type="checkbox"
            checked={props.fixedFilterActive}
            onChange={(e) => props.onChangeFixedFilterActive(e.target.checked)}
          />
          有効のみ
        </label>
        <button onClick={props.onSearch}>検索</button>
        <button className="ghost" onClick={props.onClear}>
          クリア
        </button>
        <span className="badge">合計 {props.formatMoney(props.fixedTotal)} 円</span>
      </div>

      <table>
        <thead>
          <tr>
            <th className="sortable" onClick={() => props.onToggleFixedSort("id")}>
              ID{props.fixedSortMark("id")}
            </th>
            <th className="sortable" onClick={() => props.onToggleFixedSort("name")}>
              支出名{props.fixedSortMark("name")}
            </th>
            <th className="sortable" onClick={() => props.onToggleFixedSort("yearMonth")}>
              利用年月{props.fixedSortMark("yearMonth")}
            </th>
            <th className="sortable" onClick={() => props.onToggleFixedSort("category")}>
              カテゴリ{props.fixedSortMark("category")}
            </th>
            <th className="sortable" onClick={() => props.onToggleFixedSort("amount")}>
              金額{props.fixedSortMark("amount")}
            </th>
            <th>有効</th>
            <th>メモ</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {props.sortedFixedExpenses.map((row) => {
            const draft = props.fixedDrafts[row.id];
            if (!draft) return null;
            return (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>
                  <input value={draft.name} onChange={(e) => props.onChangeFixedDraft(row.id, { name: e.target.value })} />
                </td>
                <td>
                  <input
                    value={draft.yearMonth}
                    onChange={(e) => props.onChangeFixedDraft(row.id, { yearMonth: e.target.value })}
                    placeholder="YYYY-MM"
                  />
                </td>
                <td>
                  <select
                    value={draft.categoryId}
                    onChange={(e) => props.onChangeFixedDraft(row.id, { categoryId: Number(e.target.value) })}
                  >
                    {props.categories.map((c) => (
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
                    onChange={(e) => props.onChangeFixedDraft(row.id, { amount: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(e) => props.onChangeFixedDraft(row.id, { isActive: e.target.checked })}
                  />
                </td>
                <td>
                  <input value={draft.note} onChange={(e) => props.onChangeFixedDraft(row.id, { note: e.target.value })} />
                </td>
                <td>
                  <button onClick={() => props.onSave(row.id)}>保存</button>
                  <button onClick={() => props.onDelete(row.id)}>削除</button>
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
        <input value={props.newFixedName} onChange={(e) => props.onChangeNewFixedName(e.target.value)} placeholder="支出名" />
        <input
          value={props.newFixedYearMonth}
          onChange={(e) => props.onChangeNewFixedYearMonth(e.target.value)}
          placeholder="YYYY-MM"
        />
        <select value={props.newFixedCategoryID} onChange={(e) => props.onChangeNewFixedCategoryID(Number(e.target.value))}>
          {props.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={props.newFixedAmount}
          onChange={(e) => props.onChangeNewFixedAmount(Number(e.target.value))}
          placeholder="金額"
        />
        <label>
          <input type="checkbox" checked={props.newFixedActive} onChange={(e) => props.onChangeNewFixedActive(e.target.checked)} /> 有効
        </label>
        <input value={props.newFixedNote} onChange={(e) => props.onChangeNewFixedNote(e.target.value)} placeholder="メモ" />
        <button onClick={props.onCreate}>追加</button>
      </div>
    </section>
  );
}
