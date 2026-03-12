package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"credit-kakeibo/backend/internal/domain"
	"credit-kakeibo/backend/internal/service"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/transactions", h.handleTransactions)
	mux.HandleFunc("/api/transaction-categories", h.handleTransactionCategories)
	mux.HandleFunc("/api/summary/monthly", h.handleSummaryMonthly)
	mux.HandleFunc("/api/categories", h.handleCategories)
	mux.HandleFunc("/api/categories/", h.handleCategoryByID)
	mux.HandleFunc("/api/classification-rules", h.handleClassificationRules)
	mux.HandleFunc("/api/classification-rules/", h.handleClassificationRuleByID)
	mux.HandleFunc("/api/category-rules", h.handleCategoryRules)
	mux.HandleFunc("/api/category-rules/", h.handleCategoryRuleByID)
	mux.HandleFunc("/api/uncategorized-stores", h.handleUncategorizedStores)
	mux.HandleFunc("/api/fixed-expenses", h.handleFixedExpenses)
	mux.HandleFunc("/api/fixed-expenses/", h.handleFixedExpenseByID)
	mux.HandleFunc("/api/incomes", h.handleIncomes)
	mux.HandleFunc("/api/incomes/", h.handleIncomeByID)
	mux.HandleFunc("/api/import/reload", h.handleImportReload)
	mux.HandleFunc("/api/import/status", h.handleImportStatus)
}

func (h *Handler) handleTransactionCategories(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
		return
	}
	var req struct {
		TransactionID int64 `json:"transactionId"`
		CategoryID    int64 `json:"categoryId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid json")
		return
	}
	if req.TransactionID <= 0 {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid transactionId")
		return
	}
	if err := h.svc.SetTransactionCategoryOverride(r.Context(), req.TransactionID, req.CategoryID); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	writeData(w, http.StatusOK, map[string]string{"message": "saved"})
}

func (h *Handler) handleTransactions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
		return
	}
	q := r.URL.Query()
	all := q.Get("all") == "true"
	uncategorized := q.Get("uncategorized") == "true"
	items, err := h.svc.Transactions(r.Context(), q.Get("months"), all, uncategorized, q.Get("storeName"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}
	writeData(w, http.StatusOK, items)
}

func (h *Handler) handleSummaryMonthly(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
		return
	}
	q := r.URL.Query()
	items, err := h.svc.MonthlySummary(r.Context(), q.Get("months"), q.Get("from"), q.Get("to"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}
	writeData(w, http.StatusOK, items)
}

func (h *Handler) handleCategories(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items, err := h.svc.Categories(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		writeData(w, http.StatusOK, items)
	case http.MethodPost:
		var req struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "invalid json")
			return
		}
		if err := h.svc.CreateCategory(r.Context(), req.Name); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		writeData(w, http.StatusOK, map[string]string{"message": "created"})
	default:
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
	}
}

func (h *Handler) handleCategoryByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(strings.TrimPrefix(r.URL.Path, "/api/categories/"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid categoryId")
		return
	}

	switch r.Method {
	case http.MethodPut:
		var req struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "invalid json")
			return
		}
		if err := h.svc.UpdateCategory(r.Context(), id, req.Name); err != nil {
			if strings.Contains(err.Error(), "not found") {
				writeError(w, http.StatusNotFound, "not_found", err.Error())
				return
			}
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		writeData(w, http.StatusOK, map[string]string{"message": "updated"})
	case http.MethodDelete:
		if err := h.svc.DeleteCategory(r.Context(), id); err != nil {
			if strings.Contains(err.Error(), "not found") {
				writeError(w, http.StatusNotFound, "not_found", err.Error())
				return
			}
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		writeData(w, http.StatusOK, map[string]string{"message": "deleted"})
	default:
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
	}
}

func (h *Handler) handleClassificationRules(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.handleClassificationRulesGet(w, r)
	case http.MethodPost:
		h.handleClassificationRulesPost(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
	}
}

func (h *Handler) handleClassificationRulesGet(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	var categoryID *int64
	if raw := strings.TrimSpace(q.Get("categoryId")); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "invalid categoryId")
			return
		}
		categoryID = &id
	}
	var active *bool
	if raw := strings.TrimSpace(q.Get("active")); raw != "" {
		v := raw == "true"
		active = &v
	}

	items, err := h.svc.ClassificationRules(
		r.Context(),
		categoryID,
		q.Get("matchText"),
		q.Get("sourceType"),
		q.Get("providerName"),
		active,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}
	writeData(w, http.StatusOK, items)
}

func (h *Handler) handleClassificationRulesPost(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SourceType      string `json:"sourceType"`
		ProviderName    string `json:"providerName"`
		Direction       string `json:"direction"`
		TransactionType string `json:"transactionType"`
		MatchText       string `json:"matchText"`
		CategoryID      int64  `json:"categoryId"`
		Priority        int    `json:"priority"`
		IsActive        *bool  `json:"isActive"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid json")
		return
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	if err := h.svc.CreateClassificationRule(r.Context(), toClassificationRule(req.SourceType, req.ProviderName, req.Direction, req.TransactionType, req.MatchText, req.CategoryID, req.Priority, active)); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	writeData(w, http.StatusOK, map[string]string{"message": "created"})
}

func (h *Handler) handleClassificationRuleByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(strings.TrimPrefix(r.URL.Path, "/api/classification-rules/"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid ruleId")
		return
	}

	switch r.Method {
	case http.MethodPut:
		var req struct {
			SourceType      string `json:"sourceType"`
			ProviderName    string `json:"providerName"`
			Direction       string `json:"direction"`
			TransactionType string `json:"transactionType"`
			MatchText       string `json:"matchText"`
			CategoryID      int64  `json:"categoryId"`
			Priority        int    `json:"priority"`
			IsActive        bool   `json:"isActive"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "invalid json")
			return
		}
		if err := h.svc.UpdateClassificationRule(r.Context(), id, toClassificationRule(req.SourceType, req.ProviderName, req.Direction, req.TransactionType, req.MatchText, req.CategoryID, req.Priority, req.IsActive)); err != nil {
			if strings.Contains(err.Error(), "not found") {
				writeError(w, http.StatusNotFound, "not_found", err.Error())
				return
			}
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		writeData(w, http.StatusOK, map[string]string{"message": "updated"})
	case http.MethodDelete:
		if err := h.svc.DeleteClassificationRule(r.Context(), id); err != nil {
			if strings.Contains(err.Error(), "not found") {
				writeError(w, http.StatusNotFound, "not_found", err.Error())
				return
			}
			writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		writeData(w, http.StatusOK, map[string]string{"message": "deleted"})
	default:
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
	}
}

func toClassificationRule(sourceType, providerName, direction, transactionType, matchText string, categoryID int64, priority int, active bool) domain.ClassificationRule {
	return domain.ClassificationRule{
		SourceType:      sourceType,
		ProviderName:    providerName,
		Direction:       direction,
		TransactionType: transactionType,
		MatchText:       matchText,
		CategoryID:      categoryID,
		Priority:        priority,
		IsActive:        active,
	}
}

func (h *Handler) handleCategoryRules(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.handleCategoryRulesGet(w, r)
	case http.MethodPost:
		h.handleCategoryRulesPost(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
	}
}

func (h *Handler) handleCategoryRulesGet(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	var categoryID *int64
	if raw := strings.TrimSpace(q.Get("categoryId")); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "invalid categoryId")
			return
		}
		categoryID = &id
	}
	var active *bool
	if raw := strings.TrimSpace(q.Get("active")); raw != "" {
		v := raw == "true"
		active = &v
	}

	items, err := h.svc.CategoryRules(r.Context(), categoryID, q.Get("matchText"), active)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}
	writeData(w, http.StatusOK, items)
}

func (h *Handler) handleCategoryRulesPost(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MatchText  string `json:"matchText"`
		CategoryID int64  `json:"categoryId"`
		IsActive   *bool  `json:"isActive"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid json")
		return
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}

	if err := h.svc.CreateCategoryRule(r.Context(), req.MatchText, req.CategoryID, active); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	writeData(w, http.StatusOK, map[string]string{"message": "created"})
}

func (h *Handler) handleCategoryRuleByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(strings.TrimPrefix(r.URL.Path, "/api/category-rules/"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid ruleId")
		return
	}

	switch r.Method {
	case http.MethodPut:
		var req struct {
			MatchText  string `json:"matchText"`
			CategoryID int64  `json:"categoryId"`
			IsActive   bool   `json:"isActive"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "invalid json")
			return
		}
		if err := h.svc.UpdateCategoryRule(r.Context(), id, req.MatchText, req.CategoryID, req.IsActive); err != nil {
			if strings.Contains(err.Error(), "not found") {
				writeError(w, http.StatusNotFound, "not_found", err.Error())
				return
			}
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		writeData(w, http.StatusOK, map[string]string{"message": "updated"})
	case http.MethodDelete:
		if err := h.svc.DeleteCategoryRule(r.Context(), id); err != nil {
			if strings.Contains(err.Error(), "not found") {
				writeError(w, http.StatusNotFound, "not_found", err.Error())
				return
			}
			writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		writeData(w, http.StatusOK, map[string]string{"message": "deleted"})
	default:
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
	}
}

func (h *Handler) handleUncategorizedStores(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
		return
	}
	q := r.URL.Query()
	includeCategorized := q.Get("includeCategorized") == "true"
	items, err := h.svc.UncategorizedStores(r.Context(), q.Get("storeName"), q.Get("sourceFile"), includeCategorized)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}
	writeData(w, http.StatusOK, items)
}

func (h *Handler) handleFixedExpenses(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		q := r.URL.Query()
		var active *bool
		if raw := strings.TrimSpace(q.Get("active")); raw != "" {
			v := raw == "true"
			active = &v
		}
		items, err := h.svc.FixedExpenses(r.Context(), active, q.Get("name"))
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		writeData(w, http.StatusOK, items)
	case http.MethodPost:
		var req struct {
			Name       string `json:"name"`
			YearMonth  string `json:"yearMonth"`
			CategoryID int64  `json:"categoryId"`
			Amount     int64  `json:"amount"`
			IsActive   *bool  `json:"isActive"`
			Note       string `json:"note"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "invalid json")
			return
		}
		active := true
		if req.IsActive != nil {
			active = *req.IsActive
		}
		if err := h.svc.CreateFixedExpense(r.Context(), req.Name, req.YearMonth, req.CategoryID, req.Amount, active, req.Note); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		writeData(w, http.StatusOK, map[string]string{"message": "created"})
	default:
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
	}
}

func (h *Handler) handleFixedExpenseByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(strings.TrimPrefix(r.URL.Path, "/api/fixed-expenses/"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid id")
		return
	}

	switch r.Method {
	case http.MethodPut:
		var req struct {
			Name       string `json:"name"`
			YearMonth  string `json:"yearMonth"`
			CategoryID int64  `json:"categoryId"`
			Amount     int64  `json:"amount"`
			IsActive   bool   `json:"isActive"`
			Note       string `json:"note"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "invalid json")
			return
		}
		if err := h.svc.UpdateFixedExpense(r.Context(), id, req.Name, req.YearMonth, req.CategoryID, req.Amount, req.IsActive, req.Note); err != nil {
			if strings.Contains(err.Error(), "not found") {
				writeError(w, http.StatusNotFound, "not_found", err.Error())
				return
			}
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		writeData(w, http.StatusOK, map[string]string{"message": "updated"})
	case http.MethodDelete:
		if err := h.svc.DeleteFixedExpense(r.Context(), id); err != nil {
			if strings.Contains(err.Error(), "not found") {
				writeError(w, http.StatusNotFound, "not_found", err.Error())
				return
			}
			writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		writeData(w, http.StatusOK, map[string]string{"message": "deleted"})
	default:
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
	}
}

func (h *Handler) handleIncomes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		q := r.URL.Query()
		var active *bool
		if raw := strings.TrimSpace(q.Get("active")); raw != "" {
			v := raw == "true"
			active = &v
		}
		items, err := h.svc.Incomes(r.Context(), active, q.Get("name"))
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		writeData(w, http.StatusOK, items)
	case http.MethodPost:
		var req struct {
			Name      string `json:"name"`
			YearMonth string `json:"yearMonth"`
			Amount    int64  `json:"amount"`
			IsActive  *bool  `json:"isActive"`
			Note      string `json:"note"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "invalid json")
			return
		}
		active := true
		if req.IsActive != nil {
			active = *req.IsActive
		}
		if err := h.svc.CreateIncome(r.Context(), req.Name, req.YearMonth, req.Amount, active, req.Note); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		writeData(w, http.StatusOK, map[string]string{"message": "created"})
	default:
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
	}
}

func (h *Handler) handleIncomeByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(strings.TrimPrefix(r.URL.Path, "/api/incomes/"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid id")
		return
	}

	switch r.Method {
	case http.MethodPut:
		var req struct {
			Name      string `json:"name"`
			YearMonth string `json:"yearMonth"`
			Amount    int64  `json:"amount"`
			IsActive  bool   `json:"isActive"`
			Note      string `json:"note"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "invalid json")
			return
		}
		if err := h.svc.UpdateIncome(r.Context(), id, req.Name, req.YearMonth, req.Amount, req.IsActive, req.Note); err != nil {
			if strings.Contains(err.Error(), "not found") {
				writeError(w, http.StatusNotFound, "not_found", err.Error())
				return
			}
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
		writeData(w, http.StatusOK, map[string]string{"message": "updated"})
	case http.MethodDelete:
		if err := h.svc.DeleteIncome(r.Context(), id); err != nil {
			if strings.Contains(err.Error(), "not found") {
				writeError(w, http.StatusNotFound, "not_found", err.Error())
				return
			}
			writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		writeData(w, http.StatusOK, map[string]string{"message": "deleted"})
	default:
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
	}
}

func (h *Handler) handleImportReload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
		return
	}
	res, err := h.svc.ReloadCSV(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "import_failed", err.Error())
		return
	}
	writeData(w, http.StatusOK, res)
}

func (h *Handler) handleImportStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
		return
	}
	items, err := h.svc.ImportStatuses(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}
	writeData(w, http.StatusOK, items)
}

func writeData(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"data": data})
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}
