import type {
  Category,
  CategoryRule,
  ImportResult,
  MonthlySummary,
  Transaction,
  UncategorizedStore,
} from "@/types/models";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message ?? "request failed");
  }
  return body.data as T;
}

export const api = {
  categories: () => request<Category[]>("/api/categories"),
  transactions: (q: URLSearchParams) => request<Transaction[]>(`/api/transactions?${q.toString()}`),
  summaryMonthly: (q: URLSearchParams) => request<MonthlySummary[]>(`/api/summary/monthly?${q.toString()}`),
  categoryRules: (q: URLSearchParams) => request<CategoryRule[]>(`/api/category-rules?${q.toString()}`),
  createCategoryRule: (payload: { matchText: string; categoryId: number; isActive: boolean }) =>
    request<{ message: string }>("/api/category-rules", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCategoryRule: (
    id: number,
    payload: { matchText: string; categoryId: number; isActive: boolean },
  ) =>
    request<{ message: string }>(`/api/category-rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteCategoryRule: (id: number) =>
    request<{ message: string }>(`/api/category-rules/${id}`, {
      method: "DELETE",
    }),
  uncategorizedStores: (q: URLSearchParams) =>
    request<UncategorizedStore[]>(`/api/uncategorized-stores?${q.toString()}`),
  reloadImport: () => request<ImportResult>("/api/import/reload", { method: "POST" }),
};
