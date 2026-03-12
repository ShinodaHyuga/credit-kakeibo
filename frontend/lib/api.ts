import type {
  Category,
  CategoryRule,
  ClassificationRule,
  FixedExpense,
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
  classificationRules: (q: URLSearchParams) => request<ClassificationRule[]>(`/api/classification-rules?${q.toString()}`),
  createClassificationRule: (payload: {
    sourceType: string;
    providerName: string;
    direction: string;
    transactionType: string;
    matchText: string;
    categoryId: number;
    priority: number;
    isActive: boolean;
  }) =>
    request<{ message: string }>("/api/classification-rules", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateClassificationRule: (
    id: number,
    payload: {
      sourceType: string;
      providerName: string;
      direction: string;
      transactionType: string;
      matchText: string;
      categoryId: number;
      priority: number;
      isActive: boolean;
    },
  ) =>
    request<{ message: string }>(`/api/classification-rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteClassificationRule: (id: number) =>
    request<{ message: string }>(`/api/classification-rules/${id}`, {
      method: "DELETE",
    }),
  categoryRules: (q: URLSearchParams) => request<CategoryRule[]>(`/api/category-rules?${q.toString()}`),
  setTransactionCategory: (payload: { transactionId: number; categoryId: number }) =>
    request<{ message: string }>("/api/transaction-categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
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
  fixedExpenses: (q: URLSearchParams) => request<FixedExpense[]>(`/api/fixed-expenses?${q.toString()}`),
  createFixedExpense: (payload: {
    name: string;
    yearMonth: string;
    categoryId: number;
    amount: number;
    isActive: boolean;
    note: string;
  }) =>
    request<{ message: string }>(`/api/fixed-expenses`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateFixedExpense: (
    id: number,
    payload: {
      name: string;
      yearMonth: string;
      categoryId: number;
      amount: number;
      isActive: boolean;
      note: string;
    },
  ) =>
    request<{ message: string }>(`/api/fixed-expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteFixedExpense: (id: number) =>
    request<{ message: string }>(`/api/fixed-expenses/${id}`, {
      method: "DELETE",
    }),
  reloadImport: () => request<ImportResult>("/api/import/reload", { method: "POST" }),
};
