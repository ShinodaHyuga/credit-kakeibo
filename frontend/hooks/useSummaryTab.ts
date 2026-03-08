import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import type { MonthlySummary } from "@/types/models";

type ShowNotice = (message: string, error?: boolean) => void;

export function useSummaryTab(showNotice: ShowNotice) {
  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [sumMonths, setSumMonths] = useState("");

  const loadSummary = useCallback(async () => {
    const q = new URLSearchParams();
    if (sumMonths.trim()) q.set("months", sumMonths.trim());
    const data = await api.summaryMonthly(q);
    setSummaries(data);
  }, [sumMonths]);

  const onSearch = useCallback(() => {
    void loadSummary().catch((e) => showNotice((e as Error).message, true));
  }, [loadSummary, showNotice]);

  const onClear = useCallback(() => {
    setSumMonths("");
    void loadSummary().catch((e) => showNotice((e as Error).message, true));
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
