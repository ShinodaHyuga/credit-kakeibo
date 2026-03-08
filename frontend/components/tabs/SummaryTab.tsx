import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
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
  const OTHERS_LABEL = "他カテゴリ";
  const [selectedMonth, setSelectedMonth] = useState("");

  const monthOptions = useMemo(() => props.summaries.map((row) => row.yearMonth), [props.summaries]);
  const selectedMonthValue = monthOptions.includes(selectedMonth) ? selectedMonth : monthOptions[monthOptions.length - 1] ?? "";

  const categoryColors = useMemo(() => {
    const modernPalette = [
      "#2563eb",
      "#06b6d4",
      "#22c55e",
      "#84cc16",
      "#eab308",
      "#f97316",
      "#ef4444",
      "#ec4899",
      "#a855f7",
      "#6366f1",
      "#14b8a6",
      "#0ea5e9",
    ];
    const map: Record<string, string> = {};
    props.categoryNames.forEach((name, index) => {
      map[name] = modernPalette[index % modernPalette.length];
    });
    return map;
  }, [props.categoryNames]);

  const categoryTotals = useMemo(
    () =>
      props.categoryNames
        .map((name) => ({
          name,
          total: props.summaries.reduce((sum, row) => sum + (row.categories[name] ?? 0), 0),
        }))
        .sort((a, b) => b.total - a.total),
    [props.categoryNames, props.summaries],
  );

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
    return others > 0 ? [...top, { name: OTHERS_LABEL, value: others }] : top;
  }, [OTHERS_LABEL, props.categoryNames, selectedMonthSummary]);

  const rankingData = useMemo(
    () => categoryTotals.map((item) => ({ name: item.name, value: item.total })).filter((item) => item.value > 0).slice(0, 8),
    [categoryTotals],
  );

  const getCategoryColor = (name: string): string => {
    if (name === OTHERS_LABEL) return "#64748b";
    return categoryColors[name] ?? "#2a9d8f";
  };

  return (
    <section className="panel active">
      <div className="section-head">
        <h3>収支集計</h3>
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
                  {props.categoryNames.map((name) => (
                    <Bar
                      key={name}
                      dataKey={name}
                      stackId="expense"
                      fill={getCategoryColor(name)}
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
            <div className="chart-legend">
              {props.categoryNames.map((name) => (
                <span key={name} className="legend-item">
                  <i style={{ backgroundColor: getCategoryColor(name) }} />
                  {name}
                </span>
              ))}
              <span className="legend-item">
                <i style={{ backgroundColor: "#ff7f11" }} />
                収入
              </span>
            </div>
          </article>

          <article className="chart-card chart-s2">
            <div className="chart-head">
              <h4>カテゴリ比率</h4>
              <p>{selectedMonthValue || "-"} の支出内訳</p>
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
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={ratioData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2}>
                      {ratioData.map((item) => (
                        <Cell
                          key={item.name}
                          fill={item.name === OTHERS_LABEL ? "#b08968" : getCategoryColor(item.name)}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${props.formatMoney(Number(value))}円`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="chart-empty">この月の収支データがありません</p>
              )}
            </div>
            {ratioData.length > 0 ? (
              <div className="chart-legend ratio-legend">
                {ratioData.map((item) => (
                  <span key={item.name} className="legend-item">
                    <i style={{ backgroundColor: getCategoryColor(item.name) }} />
                    {item.name}
                  </span>
                ))}
              </div>
            ) : null}
          </article>

          <article className="chart-card chart-s3">
            <div className="chart-head">
              <h4>カテゴリランキング</h4>
              <p>表示期間合計の上位8カテゴリ</p>
            </div>
            <div className="chart-canvas">
              {rankingData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={rankingData} layout="vertical" margin={{ top: 6, right: 14, bottom: 4, left: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eadfce" />
                    <XAxis type="number" tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                    <YAxis type="category" dataKey="name" width={102} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => `${props.formatMoney(Number(value))}円`} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {rankingData.map((item) => (
                        <Cell key={item.name} fill={getCategoryColor(item.name)} />
                      ))}
                    </Bar>
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
