import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import type { MonthlySummary } from "@/types/models";

type ShowNotice = (message: string, error?: boolean) => void;

function formatYearMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function defaultSummaryMonths(now = new Date()): string {
  const months: string[] = [];
  for (let offset = 12; offset >= 1; offset -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    months.push(formatYearMonth(d));
  }
  return months.join(",");
}

export function useSummaryTab(showNotice: ShowNotice) {
  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [sumMonths, setSumMonths] = useState<string>(() => defaultSummaryMonths());

  const loadSummary = useCallback(async (months?: string) => {
    const targetMonths = months ?? sumMonths;
    const q = new URLSearchParams();
    if (targetMonths.trim()) q.set("months", targetMonths.trim());
    const data = await api.summaryMonthly(q);
    setSummaries(data);
  }, [sumMonths]);

  const onSearch = useCallback(() => {
    void loadSummary().catch((e) => showNotice((e as Error).message, true));
  }, [loadSummary, showNotice]);

  const onClear = useCallback(() => {
    const initialMonths = defaultSummaryMonths();
    setSumMonths(initialMonths);
    void loadSummary(initialMonths).catch((e) => showNotice((e as Error).message, true));
  }, [loadSummary, showNotice]);

  return {
    summaries,
    sumMonths,
    loadSummary,
    onChangeSumMonths: setSumMonths,
    onSearch,
    onClear,
  };
}
