import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  const [selectedMonth, setSelectedMonth] = useState("");

  const monthOptions = useMemo(() => props.summaries.map((row) => row.yearMonth), [props.summaries]);
  const selectedMonthValue = monthOptions.includes(selectedMonth) ? selectedMonth : monthOptions[monthOptions.length - 1] ?? "";

  const palette = ["#2a9d8f", "#3a86ff", "#ff9f1c", "#ef476f", "#6a4c93", "#06d6a0", "#118ab2", "#f9844a", "#90be6d"];

  const categoryIndexMap = useMemo(() => {
    return props.categoryNames.reduce<Record<string, number>>((acc, name, index) => {
      acc[name] = index;
      return acc;
    }, {});
  }, [props.categoryNames]);

  const monthlyTrendData = useMemo(
    () =>
      props.summaries.map((row) => {
        const income = row.categories["振込"] ?? 0;
        return {
          yearMonth: row.yearMonth,
          income,
          ...props.categoryNames.reduce<Record<string, number>>((acc, name) => {
            acc[name] = row.categories[name] ?? 0;
            return acc;
          }, {}),
        };
      }),
    [props.categoryNames, props.summaries],
  );

  const selectedMonthSummary = useMemo(
    () => props.summaries.find((row) => row.yearMonth === selectedMonthValue) ?? null,
    [props.summaries, selectedMonthValue],
  );

  const ratioData = useMemo(() => {
    if (!selectedMonthSummary) return [];
    const sorted = props.categoryNames
      .map((name) => ({ name, value: selectedMonthSummary.categories[name] ?? 0 }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, 5);
    const others = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
    return others > 0 ? [...top, { name: "その他", value: others }] : top;
  }, [props.categoryNames, selectedMonthSummary]);

  const rankingData = useMemo(() => {
    const totals = props.categoryNames.map((name) => ({
      name,
      value: props.summaries.reduce((sum, row) => sum + (row.categories[name] ?? 0), 0),
    }));
    return totals.filter((item) => item.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [props.categoryNames, props.summaries]);

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

      {props.summaries.length > 0 ? (
        <div className="chart-grid">
          <article className="chart-card chart-s1">
            <div className="chart-head">
              <h4>月次推移</h4>
              <p>カテゴリ積み上げ + 収入</p>
            </div>
            <div className="chart-canvas">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eadfce" />
                  <XAxis dataKey="yearMonth" />
                  <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip formatter={(value) => `${props.formatMoney(Number(value))}円`} />
                  <Legend />
                  {props.categoryNames.map((name, index) => (
                    <Bar
                      key={name}
                      dataKey={name}
                      stackId="expense"
                      fill={palette[index % palette.length]}
                      name={name}
                      maxBarSize={48}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="#ff7f11"
                    strokeWidth={2.5}
                    dot={false}
                    name="収入"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="chart-card chart-s2">
            <div className="chart-head">
              <h4>カテゴリ比率</h4>
              <p>{selectedMonthValue || "-"} の支出構成</p>
            </div>
            <div className="chart-controls">
              <label htmlFor="ratio-month">対象月</label>
              <select id="ratio-month" value={selectedMonthValue} onChange={(e) => setSelectedMonth(e.target.value)}>
                {monthOptions.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
            <div className="chart-canvas">
              {ratioData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={ratioData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2}>
                      {ratioData.map((item) => (
                        <Cell
                          key={item.name}
                          fill={palette[(categoryIndexMap[item.name] ?? ratioData.indexOf(item)) % palette.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${props.formatMoney(Number(value))}円`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="chart-empty">この月の支出データがありません</p>
              )}
            </div>
          </article>

          <article className="chart-card chart-s3">
            <div className="chart-head">
              <h4>カテゴリランキング</h4>
              <p>表示期間合計の上位8カテゴリ</p>
            </div>
            <div className="chart-canvas">
              {rankingData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={rankingData} layout="vertical" margin={{ left: 16, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eadfce" />
                    <XAxis type="number" tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                    <YAxis type="category" dataKey="name" width={92} />
                    <Tooltip formatter={(value) => `${props.formatMoney(Number(value))}円`} />
                    <Bar dataKey="value" fill="#2a9d8f" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="chart-empty">ランキング表示できるデータがありません</p>
              )}
            </div>
          </article>
        </div>
      ) : null}

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
