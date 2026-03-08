import type { MonthlySummary } from "@/types/models";

type Props = {
  summaries: MonthlySummary[];
  categoryNames: string[];
  sumMonths: string;
  onChangeSumMonths: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
  formatMoney: (v: number) => string;
};

export function SummaryTab(props: Props) {
  return (
    <section className="panel active">
      <div className="section-head">
        <h3>支出集計</h3>
        <span className="badge">{props.summaries.length.toLocaleString("ja-JP")} ヶ月</span>
      </div>
      <div className="controls">
        <input value={props.sumMonths} onChange={(e) => props.onChangeSumMonths(e.target.value)} placeholder="months: 2026-01,2026-02" />
        <button onClick={props.onSearch}>集計</button>
        <button className="ghost" onClick={props.onClear}>
          クリア
        </button>
      </div>

      <div className="table-wrap">
        <table className="summary-table">
          <colgroup>
            <col className="col-month" />
            {props.categoryNames.map((name) => (
              <col key={`col-${name}`} className="col-category" />
            ))}
            <col className="col-total" />
            <col className="col-total" />
            <col className="col-total" />
          </colgroup>
          <thead>
            <tr>
              <th>利用年月</th>
              {props.categoryNames.map((name) => (
                <th key={name}>{name}</th>
              ))}
              <th>支出</th>
              <th>収入</th>
              <th>収支</th>
            </tr>
          </thead>
          <tbody>
            {props.summaries.map((row) => {
              const expense = props.categoryNames.reduce((sum, name) => sum + (row.categories[name] ?? 0), 0);
              const income = row.categories["振込"] ?? 0;
              const balance = income - expense;
              return (
                <tr key={row.yearMonth}>
                  <td>{row.yearMonth}</td>
                  {props.categoryNames.map((name) => (
                    <td key={`${row.yearMonth}-${name}`} className="num">
                      {props.formatMoney(row.categories[name] ?? 0)}
                    </td>
                  ))}
                  <td className="num">{props.formatMoney(expense)}</td>
                  <td className="num">{props.formatMoney(income)}</td>
                  <td className="num">{props.formatMoney(balance)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
