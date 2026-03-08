package domain

type Category struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	SortOrder int    `json:"sortOrder"`
}

type Transaction struct {
	ID            int64  `json:"id"`
	UseDate       string `json:"useDate"`
	YearMonth     string `json:"yearMonth"`
	StoreName     string `json:"storeName"`
	Category      string `json:"category"`
	Amount        int64  `json:"amount"`
	AppliedRuleID *int64 `json:"appliedRuleId,omitempty"`
}

type CategoryRule struct {
	ID           int64  `json:"id"`
	MatchText    string `json:"matchText"`
	CategoryID   int64  `json:"categoryId"`
	CategoryName string `json:"categoryName"`
	IsActive     bool   `json:"isActive"`
}

type MonthlySummary struct {
	YearMonth  string           `json:"yearMonth"`
	Categories map[string]int64 `json:"categories"`
	Total      int64            `json:"total"`
}

type ImportStatus struct {
	FileName   string `json:"fileName"`
	ImportedAt string `json:"importedAt"`
	Status     string `json:"status"`
	Message    string `json:"message"`
}

type ImportResult struct {
	TotalFiles   int `json:"totalFiles"`
	SuccessFiles int `json:"successFiles"`
	FailedFiles  int `json:"failedFiles"`
}

type UncategorizedStore struct {
	StoreName string `json:"storeName"`
}

type FixedExpense struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	YearMonth  string `json:"yearMonth"`
	CategoryID int64  `json:"categoryId"`
	Category   string `json:"category"`
	Amount     int64  `json:"amount"`
	IsActive   bool   `json:"isActive"`
	Note       string `json:"note"`
}

type Income struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	YearMonth string `json:"yearMonth"`
	Amount    int64  `json:"amount"`
	IsActive  bool   `json:"isActive"`
	Note      string `json:"note"`
}
