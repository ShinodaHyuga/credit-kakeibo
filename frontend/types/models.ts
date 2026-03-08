export type Category = {
  id: number;
  name: string;
  sortOrder: number;
};

export type Transaction = {
  id: number;
  useDate: string;
  yearMonth: string;
  storeName: string;
  category: string;
  amount: number;
  appliedRuleId?: number;
};

export type MonthlySummary = {
  yearMonth: string;
  categories: Record<string, number>;
  total: number;
};

export type CategoryRule = {
  id: number;
  matchText: string;
  categoryId: number;
  categoryName: string;
  isActive: boolean;
};

export type UncategorizedStore = {
  storeName: string;
};

export type ImportResult = {
  totalFiles: number;
  successFiles: number;
  failedFiles: number;
};

export type FixedExpense = {
  id: number;
  name: string;
  yearMonth: string;
  categoryId: number;
  category: string;
  amount: number;
  isActive: boolean;
  note: string;
};
