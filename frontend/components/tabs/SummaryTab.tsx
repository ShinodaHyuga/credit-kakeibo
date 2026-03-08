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

      <table className="summary-table">
        <colgroup>
          <col className="col-month" />
          {props.categoryNames.map((name) => (
            <col key={`col-${name}`} className="col-category" />
          ))}
          <col className="col-total" />
        </colgroup>
        <thead>
          <tr>
            <th>利用年月</th>
            {props.categoryNames.map((name) => (
              <th key={name}>{name}</th>
            ))}
            <th>合計</th>
          </tr>
        </thead>
        <tbody>
          {props.summaries.map((row) => (
            <tr key={row.yearMonth}>
              <td>{row.yearMonth}</td>
              {props.categoryNames.map((name) => (
                <td key={`${row.yearMonth}-${name}`} className="num">
                  {props.formatMoney(row.categories[name] ?? 0)}
                </td>
              ))}
              <td className="num">{props.formatMoney(row.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
