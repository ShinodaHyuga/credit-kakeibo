package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

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
	mux.HandleFunc("/api/summary/monthly", h.handleSummaryMonthly)
	mux.HandleFunc("/api/categories", h.handleCategories)
	mux.HandleFunc("/api/category-rules", h.handleCategoryRules)
	mux.HandleFunc("/api/category-rules/", h.handleCategoryRuleByID)
	mux.HandleFunc("/api/uncategorized-stores", h.handleUncategorizedStores)
	mux.HandleFunc("/api/import/reload", h.handleImportReload)
	mux.HandleFunc("/api/import/status", h.handleImportStatus)
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
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
		return
	}
	items, err := h.svc.Categories(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}
	writeData(w, http.StatusOK, items)
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
	items, err := h.svc.UncategorizedStores(r.Context(), r.URL.Query().Get("storeName"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}
	writeData(w, http.StatusOK, items)
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
