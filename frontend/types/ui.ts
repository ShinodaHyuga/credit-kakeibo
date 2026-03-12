export type SortDirection = "asc" | "desc";

export type TransactionSortKey = "useDate" | "storeName" | "category" | "amount" | "appliedRuleId";
export type RuleSortKey = "id" | "sourceType" | "matchText" | "category";
export type FixedSortKey = "id" | "name" | "yearMonth" | "category" | "amount";

export type RuleDraft = {
  sourceType: string;
  providerName: string;
  direction: string;
  transactionType: string;
  matchText: string;
  categoryId: number;
  priority: number;
  isActive: boolean;
};

export type CategoryDraft = {
  name: string;
};

export type FixedExpenseDraft = {
  name: string;
  yearMonth: string;
  categoryId: number;
  amount: number;
  isActive: boolean;
  note: string;
};
