export type SortDirection = "asc" | "desc";

export type TransactionSortKey = "useDate" | "storeName" | "category" | "amount" | "appliedRuleId";
export type RuleSortKey = "id" | "matchText" | "category";
export type FixedSortKey = "id" | "name" | "yearMonth" | "category" | "amount";
export type IncomeSortKey = "id" | "name" | "yearMonth" | "amount";

export type RuleDraft = {
  matchText: string;
  categoryId: number;
  isActive: boolean;
};

export type FixedExpenseDraft = {
  name: string;
  yearMonth: string;
  categoryId: number;
  amount: number;
  isActive: boolean;
  note: string;
};

export type IncomeDraft = {
  name: string;
  yearMonth: string;
  amount: number;
  isActive: boolean;
  note: string;
};
