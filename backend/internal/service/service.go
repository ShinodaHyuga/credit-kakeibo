package service

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"credit-kakeibo/backend/internal/csvimport"
	"credit-kakeibo/backend/internal/domain"
	"credit-kakeibo/backend/internal/repository"
)

type Service struct {
	repo    *repository.Repo
	logger  *log.Logger
	dataDir string
}

var yearMonthPattern = regexp.MustCompile(`^\d{4}-\d{2}$`)

func New(repo *repository.Repo, logger *log.Logger, dataDir string) *Service {
	return &Service{repo: repo, logger: logger, dataDir: dataDir}
}

func (s *Service) Categories(ctx context.Context) ([]domain.Category, error) {
	return s.repo.Categories(ctx)
}

func (s *Service) CreateCategory(ctx context.Context, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("name is required")
	}
	return s.repo.CreateCategory(ctx, name)
}

func (s *Service) UpdateCategory(ctx context.Context, id int64, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("name is required")
	}
	err := s.repo.UpdateCategory(ctx, id, name)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("category not found")
		}
		return err
	}
	return nil
}

func (s *Service) DeleteCategory(ctx context.Context, id int64) error {
	err := s.repo.DeleteCategory(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("category not found")
		}
		if strings.Contains(strings.ToLower(err.Error()), "foreign key") {
			return fmt.Errorf("category is in use")
		}
		return err
	}
	return nil
}

func splitMonths(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	months := make([]string, 0, len(parts))
	for _, p := range parts {
		m := strings.TrimSpace(p)
		if m != "" {
			months = append(months, m)
		}
	}
	return months
}

func (s *Service) Transactions(ctx context.Context, monthsRaw string, all, uncategorized bool, storeName string) ([]domain.Transaction, error) {
	months := splitMonths(monthsRaw)
	if !all && len(months) == 0 {
		recent, err := s.repo.RecentMonths(ctx, 3)
		if err != nil {
			return nil, err
		}
		months = recent
	}
	return s.repo.Transactions(ctx, repository.TransactionFilter{
		Months:        months,
		All:           all,
		Uncategorized: uncategorized,
		StoreName:     storeName,
	})
}

func (s *Service) MonthlySummary(ctx context.Context, monthsRaw, from, to string) ([]domain.MonthlySummary, error) {
	categories, err := s.repo.Categories(ctx)
	if err != nil {
		return nil, err
	}
	months := splitMonths(monthsRaw)
	agg, err := s.repo.MonthlySummary(ctx, months, from, to)
	if err != nil {
		return nil, err
	}

	keys := make([]string, 0, len(agg))
	for ym := range agg {
		keys = append(keys, ym)
	}
	sort.Strings(keys)

	res := make([]domain.MonthlySummary, 0, len(keys))
	for _, ym := range keys {
		row := domain.MonthlySummary{
			YearMonth:  ym,
			Categories: map[string]int64{},
		}
		for _, c := range categories {
			row.Categories[c.Name] = 0
		}
		for cat, val := range agg[ym] {
			row.Categories[cat] = val
			row.Total += val
		}
		res = append(res, row)
	}
	return res, nil
}

func (s *Service) CategoryRules(ctx context.Context, categoryID *int64, matchText string, active *bool) ([]domain.CategoryRule, error) {
	return s.repo.CategoryRules(ctx, repository.CategoryRuleFilter{
		CategoryID: categoryID,
		MatchText:  matchText,
		Active:     active,
	})
}

func (s *Service) ClassificationRules(ctx context.Context, categoryID *int64, matchText, sourceType, providerName string, active *bool) ([]domain.ClassificationRule, error) {
	return s.repo.ClassificationRules(ctx, repository.ClassificationRuleFilter{
		CategoryID:   categoryID,
		MatchText:    strings.TrimSpace(matchText),
		SourceType:   strings.TrimSpace(sourceType),
		ProviderName: strings.TrimSpace(providerName),
		Active:       active,
	})
}

func (s *Service) CreateClassificationRule(ctx context.Context, rule domain.ClassificationRule) error {
	if strings.TrimSpace(rule.MatchText) == "" {
		return fmt.Errorf("matchText is required")
	}
	if rule.Priority <= 0 {
		rule.Priority = 100
	}
	exists, err := s.repo.CategoryExists(ctx, rule.CategoryID)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("category not found")
	}
	rule.MatchText = strings.TrimSpace(rule.MatchText)
	rule.SourceType = strings.TrimSpace(rule.SourceType)
	rule.ProviderName = strings.TrimSpace(rule.ProviderName)
	rule.Direction = strings.TrimSpace(rule.Direction)
	rule.TransactionType = strings.TrimSpace(rule.TransactionType)
	return s.repo.CreateClassificationRule(ctx, rule)
}

func (s *Service) UpdateClassificationRule(ctx context.Context, id int64, rule domain.ClassificationRule) error {
	if strings.TrimSpace(rule.MatchText) == "" {
		return fmt.Errorf("matchText is required")
	}
	if rule.Priority <= 0 {
		rule.Priority = 100
	}
	exists, err := s.repo.CategoryExists(ctx, rule.CategoryID)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("category not found")
	}
	rule.MatchText = strings.TrimSpace(rule.MatchText)
	rule.SourceType = strings.TrimSpace(rule.SourceType)
	rule.ProviderName = strings.TrimSpace(rule.ProviderName)
	rule.Direction = strings.TrimSpace(rule.Direction)
	rule.TransactionType = strings.TrimSpace(rule.TransactionType)
	err = s.repo.UpdateClassificationRule(ctx, id, rule)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("classification rule not found")
		}
		return err
	}
	return nil
}

func (s *Service) DeleteClassificationRule(ctx context.Context, id int64) error {
	err := s.repo.DeleteClassificationRule(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("classification rule not found")
		}
		return err
	}
	return nil
}

func (s *Service) CreateCategoryRule(ctx context.Context, matchText string, categoryID int64, isActive bool) error {
	if strings.TrimSpace(matchText) == "" {
		return fmt.Errorf("matchText is required")
	}
	exists, err := s.repo.CategoryExists(ctx, categoryID)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("category not found")
	}
	return s.repo.CreateCategoryRule(ctx, strings.TrimSpace(matchText), categoryID, isActive)
}

func (s *Service) UpdateCategoryRule(ctx context.Context, id int64, matchText string, categoryID int64, isActive bool) error {
	if strings.TrimSpace(matchText) == "" {
		return fmt.Errorf("matchText is required")
	}
	exists, err := s.repo.CategoryExists(ctx, categoryID)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("category not found")
	}
	err = s.repo.UpdateCategoryRule(ctx, id, strings.TrimSpace(matchText), categoryID, isActive)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("rule not found")
		}
		return err
	}
	return nil
}

func (s *Service) DeleteCategoryRule(ctx context.Context, id int64) error {
	err := s.repo.DeleteCategoryRule(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("rule not found")
		}
		return err
	}
	return nil
}

func (s *Service) SetTransactionCategoryOverride(ctx context.Context, transactionID, categoryID int64) error {
	exists, err := s.repo.CategoryExists(ctx, categoryID)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("category not found")
	}
	return s.repo.SetTransactionCategoryOverride(ctx, transactionID, categoryID)
}

func (s *Service) UncategorizedStores(ctx context.Context, storeName, sourceFile string, includeCategorized bool) ([]domain.UncategorizedStore, error) {
	return s.repo.UncategorizedStores(ctx, storeName, sourceFile, includeCategorized)
}

func (s *Service) FixedExpenses(ctx context.Context, active *bool, name string) ([]domain.FixedExpense, error) {
	return s.repo.FixedExpenses(ctx, repository.FixedExpenseFilter{
		Active: active,
		Name:   name,
	})
}

func (s *Service) CreateFixedExpense(ctx context.Context, name, yearMonth string, categoryID, amount int64, isActive bool, note string) error {
	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("name is required")
	}
	if !yearMonthPattern.MatchString(strings.TrimSpace(yearMonth)) {
		return fmt.Errorf("yearMonth must be YYYY-MM")
	}
	exists, err := s.repo.CategoryExists(ctx, categoryID)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("category not found")
	}
	return s.repo.CreateFixedExpense(
		ctx,
		strings.TrimSpace(name),
		strings.TrimSpace(yearMonth),
		categoryID,
		amount,
		isActive,
		strings.TrimSpace(note),
	)
}

func (s *Service) UpdateFixedExpense(ctx context.Context, id int64, name, yearMonth string, categoryID, amount int64, isActive bool, note string) error {
	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("name is required")
	}
	if !yearMonthPattern.MatchString(strings.TrimSpace(yearMonth)) {
		return fmt.Errorf("yearMonth must be YYYY-MM")
	}
	exists, err := s.repo.CategoryExists(ctx, categoryID)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("category not found")
	}
	err = s.repo.UpdateFixedExpense(
		ctx,
		id,
		strings.TrimSpace(name),
		strings.TrimSpace(yearMonth),
		categoryID,
		amount,
		isActive,
		strings.TrimSpace(note),
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("fixed expense not found")
		}
		return err
	}
	return nil
}

func (s *Service) DeleteFixedExpense(ctx context.Context, id int64) error {
	err := s.repo.DeleteFixedExpense(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("fixed expense not found")
		}
		return err
	}
	return nil
}

func (s *Service) Incomes(ctx context.Context, active *bool, name string) ([]domain.Income, error) {
	return s.repo.Incomes(ctx, repository.IncomeFilter{
		Active: active,
		Name:   name,
	})
}

func (s *Service) CreateIncome(ctx context.Context, name, yearMonth string, amount int64, isActive bool, note string) error {
	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("name is required")
	}
	if !yearMonthPattern.MatchString(strings.TrimSpace(yearMonth)) {
		return fmt.Errorf("yearMonth must be YYYY-MM")
	}
	return s.repo.CreateIncome(
		ctx,
		strings.TrimSpace(name),
		strings.TrimSpace(yearMonth),
		amount,
		isActive,
		strings.TrimSpace(note),
	)
}

func (s *Service) UpdateIncome(ctx context.Context, id int64, name, yearMonth string, amount int64, isActive bool, note string) error {
	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("name is required")
	}
	if !yearMonthPattern.MatchString(strings.TrimSpace(yearMonth)) {
		return fmt.Errorf("yearMonth must be YYYY-MM")
	}
	err := s.repo.UpdateIncome(
		ctx,
		id,
		strings.TrimSpace(name),
		strings.TrimSpace(yearMonth),
		amount,
		isActive,
		strings.TrimSpace(note),
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("income not found")
		}
		return err
	}
	return nil
}

func (s *Service) DeleteIncome(ctx context.Context, id int64) error {
	err := s.repo.DeleteIncome(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("income not found")
		}
		return err
	}
	return nil
}

func (s *Service) ReloadCSV(ctx context.Context) (domain.ImportResult, error) {
	files, err := csvimport.ListTargetFiles(s.dataDir)
	if err != nil {
		return domain.ImportResult{}, err
	}

	result := domain.ImportResult{TotalFiles: len(files)}
	for _, fullPath := range files {
		fileName := filepath.Base(fullPath)
		if err := s.repo.DeleteTransactionsBySourceFile(ctx, fileName); err != nil {
			result.FailedFiles++
			s.logError(fileName, err)
			_ = s.repo.ReplaceImportedFile(ctx, fileName, "failed", err.Error())
			continue
		}

		records, err := csvimport.ParseFile(fullPath)
		if err != nil {
			result.FailedFiles++
			s.logError(fileName, err)
			_ = s.repo.ReplaceImportedFile(ctx, fileName, "failed", err.Error())
			continue
		}

		if err := s.repo.InsertTransactions(ctx, fileName, records); err != nil {
			result.FailedFiles++
			s.logError(fileName, err)
			_ = s.repo.ReplaceImportedFile(ctx, fileName, "failed", err.Error())
			continue
		}

		result.SuccessFiles++
		_ = s.repo.ReplaceImportedFile(ctx, fileName, "success", fmt.Sprintf("rows=%d", len(records)))
	}
	return result, nil
}

func (s *Service) ImportStatuses(ctx context.Context) ([]domain.ImportStatus, error) {
	return s.repo.ImportStatuses(ctx)
}

func (s *Service) logError(fileName string, err error) {
	s.logger.Printf("file=%s err=%v", fileName, err)
}
