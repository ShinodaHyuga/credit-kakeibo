import type { Income } from "@/types/models";
import type { IncomeDraft, IncomeSortKey } from "@/types/ui";

type Props = {
  incomes: Income[];
  sortedIncomes: Income[];
  incomeDrafts: Record<number, IncomeDraft>;
  incomeFilterName: string;
  incomeFilterActive: boolean;
  incomeTotal: number;
  newIncomeName: string;
  newIncomeYearMonth: string;
  newIncomeAmount: number;
  newIncomeActive: boolean;
  newIncomeNote: string;
  incomeSortMark: (key: IncomeSortKey) => string;
  onToggleIncomeSort: (key: IncomeSortKey) => void;
  onChangeIncomeFilterName: (value: string) => void;
  onChangeIncomeFilterActive: (value: boolean) => void;
  onSearch: () => void;
  onClear: () => void;
  onChangeIncomeDraft: (id: number, patch: Partial<IncomeDraft>) => void;
  onSave: (id: number) => void;
  onDelete: (id: number) => void;
  onChangeNewIncomeName: (value: string) => void;
  onChangeNewIncomeYearMonth: (value: string) => void;
  onChangeNewIncomeAmount: (value: number) => void;
  onChangeNewIncomeActive: (value: boolean) => void;
  onChangeNewIncomeNote: (value: string) => void;
  onCreate: () => void;
  formatMoney: (v: number) => string;
};

export function IncomesTab(props: Props) {
  return (
    <section className="panel active">
      <div className="section-head">
        <h3>収入</h3>
        <span className="badge">{props.incomes.length.toLocaleString("ja-JP")} 件</span>
      </div>
      <div className="controls">
        <input value={props.incomeFilterName} onChange={(e) => props.onChangeIncomeFilterName(e.target.value)} placeholder="収入名検索" />
        <label>
          <input
            type="checkbox"
            checked={props.incomeFilterActive}
            onChange={(e) => props.onChangeIncomeFilterActive(e.target.checked)}
          />
          有効のみ
        </label>
        <button onClick={props.onSearch}>検索</button>
        <button className="ghost" onClick={props.onClear}>
          クリア
        </button>
        <span className="badge">合計 {props.formatMoney(props.incomeTotal)} 円</span>
      </div>

      <table>
        <thead>
          <tr>
            <th className="sortable" onClick={() => props.onToggleIncomeSort("id")}>
              ID{props.incomeSortMark("id")}
            </th>
            <th className="sortable" onClick={() => props.onToggleIncomeSort("name")}>
              収入名{props.incomeSortMark("name")}
            </th>
            <th className="sortable" onClick={() => props.onToggleIncomeSort("yearMonth")}>
              利用年月{props.incomeSortMark("yearMonth")}
            </th>
            <th className="sortable" onClick={() => props.onToggleIncomeSort("amount")}>
              金額{props.incomeSortMark("amount")}
            </th>
            <th>有効</th>
            <th>メモ</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {props.sortedIncomes.map((row) => {
            const draft = props.incomeDrafts[row.id];
            if (!draft) return null;
            return (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>
                  <input value={draft.name} onChange={(e) => props.onChangeIncomeDraft(row.id, { name: e.target.value })} />
                </td>
                <td>
                  <input
                    value={draft.yearMonth}
                    onChange={(e) => props.onChangeIncomeDraft(row.id, { yearMonth: e.target.value })}
                    placeholder="YYYY-MM"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={draft.amount}
                    onChange={(e) => props.onChangeIncomeDraft(row.id, { amount: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(e) => props.onChangeIncomeDraft(row.id, { isActive: e.target.checked })}
                  />
                </td>
                <td>
                  <input value={draft.note} onChange={(e) => props.onChangeIncomeDraft(row.id, { note: e.target.value })} />
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
        <h3>新規収入追加</h3>
      </div>
      <div className="controls">
        <input value={props.newIncomeName} onChange={(e) => props.onChangeNewIncomeName(e.target.value)} placeholder="収入名" />
        <input
          value={props.newIncomeYearMonth}
          onChange={(e) => props.onChangeNewIncomeYearMonth(e.target.value)}
          placeholder="YYYY-MM"
        />
        <input
          type="number"
          value={props.newIncomeAmount}
          onChange={(e) => props.onChangeNewIncomeAmount(Number(e.target.value))}
          placeholder="金額"
        />
        <label>
          <input type="checkbox" checked={props.newIncomeActive} onChange={(e) => props.onChangeNewIncomeActive(e.target.checked)} /> 有効
        </label>
        <input value={props.newIncomeNote} onChange={(e) => props.onChangeNewIncomeNote(e.target.value)} placeholder="メモ" />
        <button onClick={props.onCreate}>追加</button>
      </div>
    </section>
  );
}
