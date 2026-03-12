package repository

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"strings"
	"time"

	"credit-kakeibo/backend/internal/csvimport"
	"credit-kakeibo/backend/internal/domain"
)

type Repo struct {
	db *sql.DB
}

func New(db *sql.DB) *Repo {
	return &Repo{db: db}
}

func (r *Repo) Categories(ctx context.Context) ([]domain.Category, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, name, sort_order FROM categories ORDER BY sort_order ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]domain.Category, 0, 16)
	for rows.Next() {
		var c domain.Category
		if err := rows.Scan(&c.ID, &c.Name, &c.SortOrder); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, rows.Err()
}

func (r *Repo) CreateCategory(ctx context.Context, name string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO categories(name, sort_order)
		 VALUES(?, COALESCE((SELECT MAX(sort_order) + 1 FROM categories), 1))`,
		name,
	)
	return err
}

func (r *Repo) UpdateCategory(ctx context.Context, id int64, name string) error {
	res, err := r.db.ExecContext(ctx, `UPDATE categories SET name = ? WHERE id = ?`, name, id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *Repo) DeleteCategory(ctx context.Context, id int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM categories WHERE id = ?`, id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *Repo) CategoryExists(ctx context.Context, id int64) (bool, error) {
	var exists int
	err := r.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?)`, id).Scan(&exists)
	return exists == 1, err
}

type TransactionFilter struct {
	Months        []string
	Uncategorized bool
	StoreName     string
	All           bool
}

func (r *Repo) RecentMonths(ctx context.Context, limit int) ([]string, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT year_month FROM transactions GROUP BY year_month ORDER BY year_month DESC LIMIT ?`, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var months []string
	for rows.Next() {
		var m string
		if err := rows.Scan(&m); err != nil {
			return nil, err
		}
		months = append(months, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sort.Strings(months)
	return months, nil
}

func ruleJoinClause() string {
	return `
LEFT JOIN category_match_rules r ON r.id = (
	SELECT r2.id
	FROM category_match_rules r2
	WHERE r2.is_active = 1
	  AND instr(t.store_name, r2.match_text) > 0
	ORDER BY length(r2.match_text) DESC, r2.id ASC
	LIMIT 1
)
LEFT JOIN categories c ON c.id = r.category_id`
}

func classificationRulePredicate(alias string, activeOnly bool) string {
	activeClause := ""
	if activeOnly {
		activeClause = fmt.Sprintf(" AND %s.is_active = 1", alias)
	}
	return fmt.Sprintf(`1=1%s
	  AND (%s.source_type = '' OR %s.source_type = t.source_type)
	  AND (%s.provider_name = '' OR %s.provider_name = t.provider_name)
	  AND (%s.direction = '' OR %s.direction = t.direction)
	  AND (%s.transaction_type = '' OR %s.transaction_type = t.transaction_type)
	  AND (%s.counterparty_match = '' OR instr(t.counterparty_name, %s.counterparty_match) > 0 OR instr(t.store_name, %s.counterparty_match) > 0)
	  AND (%s.merchant_match = '' OR instr(t.merchant_name, %s.merchant_match) > 0 OR instr(t.store_name, %s.merchant_match) > 0)
	  AND (%s.description_match = '' OR instr(t.description_raw, %s.description_match) > 0 OR instr(t.store_name, %s.description_match) > 0)
	  AND (%s.method_match = '' OR instr(t.method, %s.method_match) > 0)`,
		activeClause,
		alias, alias,
		alias, alias,
		alias, alias,
		alias, alias,
		alias, alias, alias,
		alias, alias, alias,
		alias, alias, alias,
		alias, alias,
	)
}

func categoryResolutionJoinClause() string {
	return `
LEFT JOIN transaction_category_overrides o ON o.transaction_id = t.id
LEFT JOIN categories c_override ON c_override.id = o.category_id
LEFT JOIN classification_rules cr_active ON cr_active.id = (
	SELECT cr2.id
	FROM classification_rules cr2
	WHERE ` + classificationRulePredicate("cr2", true) + `
	ORDER BY cr2.priority ASC, length(cr2.counterparty_match || cr2.merchant_match || cr2.description_match || cr2.method_match) DESC, cr2.id ASC
	LIMIT 1
)
LEFT JOIN categories c_cr_active ON c_cr_active.id = cr_active.category_id
LEFT JOIN category_match_rules r_active ON r_active.id = (
	SELECT r2.id
	FROM category_match_rules r2
	WHERE r2.is_active = 1
	  AND instr(t.store_name, r2.match_text) > 0
	ORDER BY length(r2.match_text) DESC, r2.id ASC
	LIMIT 1
)
LEFT JOIN categories c_active ON c_active.id = r_active.category_id
LEFT JOIN classification_rules cr_any ON cr_any.id = (
	SELECT cr3.id
	FROM classification_rules cr3
	WHERE ` + classificationRulePredicate("cr3", false) + `
	ORDER BY cr3.priority ASC, length(cr3.counterparty_match || cr3.merchant_match || cr3.description_match || cr3.method_match) DESC, cr3.id ASC
	LIMIT 1
)
LEFT JOIN categories c_cr_any ON c_cr_any.id = cr_any.category_id
LEFT JOIN category_match_rules r_any ON r_any.id = (
	SELECT r3.id
	FROM category_match_rules r3
	WHERE instr(t.store_name, r3.match_text) > 0
	ORDER BY length(r3.match_text) DESC, r3.id ASC
	LIMIT 1
)
LEFT JOIN categories c_any ON c_any.id = r_any.category_id`
}

func (r *Repo) Transactions(ctx context.Context, f TransactionFilter) ([]domain.Transaction, error) {
	base := `
SELECT t.id, t.use_date, t.year_month, t.source_type, t.provider_name, t.direction, t.transaction_type, t.store_name,
       COALESCE(c_override.name, c_cr_active.name, c_active.name, c_cr_any.name, c_any.name, '未分類') AS category,
       t.amount,
       COALESCE(cr_active.id, r_active.id, cr_any.id, r_any.id) AS applied_rule_id
FROM transactions t` + categoryResolutionJoinClause() + `
WHERE 1=1`

	args := make([]any, 0, 10)
	if len(f.Months) > 0 {
		base += " AND t.year_month IN (" + placeholders(len(f.Months)) + ")"
		for _, m := range f.Months {
			args = append(args, m)
		}
	}
	if f.Uncategorized {
		base += " AND o.transaction_id IS NULL AND cr_any.id IS NULL AND r_any.id IS NULL"
	}
	if f.StoreName != "" {
		base += " AND t.store_name LIKE ?"
		args = append(args, "%"+f.StoreName+"%")
	}
	base += " ORDER BY t.use_date DESC, t.id DESC"

	rows, err := r.db.QueryContext(ctx, base, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]domain.Transaction, 0, 256)
	for rows.Next() {
		var t domain.Transaction
		var ruleID sql.NullInt64
		if err := rows.Scan(&t.ID, &t.UseDate, &t.YearMonth, &t.SourceType, &t.ProviderName, &t.Direction, &t.TransactionType, &t.StoreName, &t.Category, &t.Amount, &ruleID); err != nil {
			return nil, err
		}
		if ruleID.Valid {
			t.AppliedRuleID = &ruleID.Int64
		}
		items = append(items, t)
	}
	return items, rows.Err()
}

func (r *Repo) MonthlySummary(ctx context.Context, months []string, from, to string) (map[string]map[string]int64, error) {
	q := `
SELECT base.year_month, base.category, SUM(base.amount)
FROM (
  SELECT t.year_month AS year_month, COALESCE(c_override.name, c_cr_active.name, c.name, c_cr_any.name, c_any.name, '未分類') AS category, t.amount AS amount
  FROM transactions t
  LEFT JOIN transaction_category_overrides o ON o.transaction_id = t.id
  LEFT JOIN categories c_override ON c_override.id = o.category_id
  LEFT JOIN classification_rules cr_active ON cr_active.id = (
    SELECT cr2.id
    FROM classification_rules cr2
    WHERE ` + classificationRulePredicate("cr2", true) + `
    ORDER BY cr2.priority ASC, length(cr2.counterparty_match || cr2.merchant_match || cr2.description_match || cr2.method_match) DESC, cr2.id ASC
    LIMIT 1
  )
  LEFT JOIN categories c_cr_active ON c_cr_active.id = cr_active.category_id` + ruleJoinClause() + `
  LEFT JOIN classification_rules cr_any ON cr_any.id = (
    SELECT cr3.id
    FROM classification_rules cr3
    WHERE ` + classificationRulePredicate("cr3", false) + `
    ORDER BY cr3.priority ASC, length(cr3.counterparty_match || cr3.merchant_match || cr3.description_match || cr3.method_match) DESC, cr3.id ASC
    LIMIT 1
  )
  LEFT JOIN categories c_cr_any ON c_cr_any.id = cr_any.category_id
  LEFT JOIN category_match_rules r_any ON r_any.id = (
    SELECT r3.id
    FROM category_match_rules r3
    WHERE instr(t.store_name, r3.match_text) > 0
    ORDER BY length(r3.match_text) DESC, r3.id ASC
    LIMIT 1
  )
  LEFT JOIN categories c_any ON c_any.id = r_any.category_id
  WHERE NOT EXISTS (
    SELECT 1 FROM category_match_rules r0
    WHERE r0.is_active = 0
      AND instr(t.store_name, r0.match_text) > 0
  )
  UNION ALL
  SELECT fe.year_month AS year_month, c.name AS category, fe.amount AS amount
  FROM fixed_expenses fe
  JOIN categories c ON c.id = fe.category_id
  WHERE fe.is_active = 1
) base
WHERE 1=1`
	args := make([]any, 0, 8)

	if len(months) > 0 {
		q += " AND base.year_month IN (" + placeholders(len(months)) + ")"
		for _, m := range months {
			args = append(args, m)
		}
	}
	if from != "" {
		q += " AND base.year_month >= ?"
		args = append(args, from)
	}
	if to != "" {
		q += " AND base.year_month <= ?"
		args = append(args, to)
	}
	q += " GROUP BY base.year_month, base.category ORDER BY base.year_month ASC"

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := map[string]map[string]int64{}
	for rows.Next() {
		var ym, cat string
		var sum int64
		if err := rows.Scan(&ym, &cat, &sum); err != nil {
			return nil, err
		}
		if _, ok := result[ym]; !ok {
			result[ym] = map[string]int64{}
		}
		result[ym][cat] = sum
	}
	return result, rows.Err()
}

type CategoryRuleFilter struct {
	CategoryID *int64
	MatchText  string
	Active     *bool
}

func (r *Repo) CategoryRules(ctx context.Context, f CategoryRuleFilter) ([]domain.CategoryRule, error) {
	q := `
SELECT r.id, r.match_text, r.category_id, c.name, r.is_active
FROM category_match_rules r
JOIN categories c ON c.id = r.category_id
WHERE 1=1`
	args := make([]any, 0, 4)

	if f.CategoryID != nil {
		q += " AND r.category_id = ?"
		args = append(args, *f.CategoryID)
	}
	if f.MatchText != "" {
		q += " AND r.match_text LIKE ?"
		args = append(args, "%"+f.MatchText+"%")
	}
	if f.Active != nil {
		q += " AND r.is_active = ?"
		if *f.Active {
			args = append(args, 1)
		} else {
			args = append(args, 0)
		}
	}

	q += " ORDER BY length(r.match_text) DESC, r.id ASC"

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]domain.CategoryRule, 0, 128)
	for rows.Next() {
		var item domain.CategoryRule
		var active int
		if err := rows.Scan(&item.ID, &item.MatchText, &item.CategoryID, &item.CategoryName, &active); err != nil {
			return nil, err
		}
		item.IsActive = active == 1
		items = append(items, item)
	}
	return items, rows.Err()
}

type ClassificationRuleFilter struct {
	CategoryID   *int64
	MatchText    string
	SourceType   string
	ProviderName string
	Active       *bool
}

func (r *Repo) ClassificationRules(ctx context.Context, f ClassificationRuleFilter) ([]domain.ClassificationRule, error) {
	q := `
SELECT r.id, r.source_type, r.provider_name, r.direction, r.transaction_type,
       r.description_match, r.category_id, c.name, r.priority, r.is_active
FROM classification_rules r
JOIN categories c ON c.id = r.category_id
WHERE 1=1`
	args := make([]any, 0, 6)

	if f.CategoryID != nil {
		q += " AND r.category_id = ?"
		args = append(args, *f.CategoryID)
	}
	if f.MatchText != "" {
		q += " AND r.description_match LIKE ?"
		args = append(args, "%"+f.MatchText+"%")
	}
	if f.SourceType != "" {
		q += " AND r.source_type = ?"
		args = append(args, f.SourceType)
	}
	if f.ProviderName != "" {
		q += " AND r.provider_name LIKE ?"
		args = append(args, "%"+f.ProviderName+"%")
	}
	if f.Active != nil {
		q += " AND r.is_active = ?"
		if *f.Active {
			args = append(args, 1)
		} else {
			args = append(args, 0)
		}
	}

	q += " ORDER BY r.priority ASC, length(r.description_match) DESC, r.id ASC"
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]domain.ClassificationRule, 0, 128)
	for rows.Next() {
		var item domain.ClassificationRule
		var active int
		if err := rows.Scan(
			&item.ID,
			&item.SourceType,
			&item.ProviderName,
			&item.Direction,
			&item.TransactionType,
			&item.MatchText,
			&item.CategoryID,
			&item.CategoryName,
			&item.Priority,
			&active,
		); err != nil {
			return nil, err
		}
		item.IsActive = active == 1
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repo) CreateClassificationRule(ctx context.Context, rule domain.ClassificationRule) error {
	active := 0
	if rule.IsActive {
		active = 1
	}
	now := time.Now().Format(time.RFC3339)
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO classification_rules(
			rule_name, source_type, provider_name, direction, transaction_type,
			counterparty_match, merchant_match, description_match, method_match,
			category_id, priority, is_active, created_at, updated_at
		) VALUES('', ?, ?, ?, ?, '', '', ?, '', ?, ?, ?, ?, ?)`,
		rule.SourceType,
		rule.ProviderName,
		rule.Direction,
		rule.TransactionType,
		rule.MatchText,
		rule.CategoryID,
		rule.Priority,
		active,
		now,
		now,
	)
	return err
}

func (r *Repo) UpdateClassificationRule(ctx context.Context, id int64, rule domain.ClassificationRule) error {
	active := 0
	if rule.IsActive {
		active = 1
	}
	res, err := r.db.ExecContext(ctx,
		`UPDATE classification_rules
		 SET source_type = ?, provider_name = ?, direction = ?, transaction_type = ?,
		     description_match = ?, category_id = ?, priority = ?, is_active = ?, updated_at = ?
		 WHERE id = ?`,
		rule.SourceType,
		rule.ProviderName,
		rule.Direction,
		rule.TransactionType,
		rule.MatchText,
		rule.CategoryID,
		rule.Priority,
		active,
		time.Now().Format(time.RFC3339),
		id,
	)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *Repo) DeleteClassificationRule(ctx context.Context, id int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM classification_rules WHERE id = ?`, id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *Repo) CreateCategoryRule(ctx context.Context, matchText string, categoryID int64, isActive bool) error {
	active := 0
	if isActive {
		active = 1
	}
	now := time.Now().Format(time.RFC3339)
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO category_match_rules(match_text, category_id, is_active, created_at, updated_at)
		 VALUES(?, ?, ?, ?, ?)
		 ON CONFLICT(match_text) DO UPDATE SET
		   category_id = excluded.category_id,
		   is_active = excluded.is_active,
		   updated_at = excluded.updated_at`,
		matchText, categoryID, active, now, now,
	)
	return err
}

func (r *Repo) UpdateCategoryRule(ctx context.Context, id int64, matchText string, categoryID int64, isActive bool) error {
	active := 0
	if isActive {
		active = 1
	}
	res, err := r.db.ExecContext(ctx,
		`UPDATE category_match_rules
		 SET match_text = ?, category_id = ?, is_active = ?, updated_at = ?
		 WHERE id = ?`,
		matchText, categoryID, active, time.Now().Format(time.RFC3339), id,
	)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *Repo) DeleteCategoryRule(ctx context.Context, id int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM category_match_rules WHERE id = ?`, id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *Repo) UncategorizedStores(ctx context.Context, storeName, sourceFile string, includeCategorized bool) ([]domain.UncategorizedStore, error) {
	q := `
SELECT DISTINCT t.store_name
FROM transactions t
LEFT JOIN transaction_category_overrides o ON o.transaction_id = t.id
LEFT JOIN classification_rules cr_any ON cr_any.id = (
	SELECT cr3.id
	FROM classification_rules cr3
	WHERE ` + classificationRulePredicate("cr3", false) + `
	ORDER BY cr3.priority ASC, length(cr3.counterparty_match || cr3.merchant_match || cr3.description_match || cr3.method_match) DESC, cr3.id ASC
	LIMIT 1
)
WHERE 1=1`
	args := make([]any, 0, 2)
	if !includeCategorized {
		q += `
 AND o.transaction_id IS NULL
 AND cr_any.id IS NULL
 AND NOT EXISTS (
	SELECT 1 FROM category_match_rules r
	WHERE instr(t.store_name, r.match_text) > 0
)`
	}
	if sourceFile != "" {
		q += " AND t.source_file = ?"
		args = append(args, sourceFile)
	}
	if storeName != "" {
		q += " AND t.store_name LIKE ?"
		args = append(args, "%"+storeName+"%")
	}
	q += " ORDER BY t.store_name ASC"

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]domain.UncategorizedStore, 0, 64)
	for rows.Next() {
		var item domain.UncategorizedStore
		if err := rows.Scan(&item.StoreName); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repo) SetTransactionCategoryOverride(ctx context.Context, transactionID, categoryID int64) error {
	now := time.Now().Format(time.RFC3339)
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO transaction_category_overrides(transaction_id, category_id, note, created_at, updated_at)
		 VALUES(?, ?, '', ?, ?)
		 ON CONFLICT(transaction_id) DO UPDATE SET
		   category_id = excluded.category_id,
		   updated_at = excluded.updated_at`,
		transactionID, categoryID, now, now,
	)
	return err
}

type FixedExpenseFilter struct {
	Active *bool
	Name   string
}

func (r *Repo) FixedExpenses(ctx context.Context, f FixedExpenseFilter) ([]domain.FixedExpense, error) {
	q := `
SELECT fe.id, fe.name, fe.year_month, fe.category_id, c.name, fe.amount, fe.is_active, fe.note
FROM fixed_expenses fe
JOIN categories c ON c.id = fe.category_id
WHERE 1=1`
	args := make([]any, 0, 2)

	if f.Active != nil {
		q += " AND fe.is_active = ?"
		if *f.Active {
			args = append(args, 1)
		} else {
			args = append(args, 0)
		}
	}
	if f.Name != "" {
		q += " AND fe.name LIKE ?"
		args = append(args, "%"+f.Name+"%")
	}
	q += " ORDER BY fe.name ASC, fe.id ASC"

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]domain.FixedExpense, 0, 64)
	for rows.Next() {
		var item domain.FixedExpense
		var active int
		if err := rows.Scan(&item.ID, &item.Name, &item.YearMonth, &item.CategoryID, &item.Category, &item.Amount, &active, &item.Note); err != nil {
			return nil, err
		}
		item.IsActive = active == 1
		list = append(list, item)
	}
	return list, rows.Err()
}

func (r *Repo) CreateFixedExpense(ctx context.Context, name, yearMonth string, categoryID, amount int64, isActive bool, note string) error {
	active := 0
	if isActive {
		active = 1
	}
	now := time.Now().Format(time.RFC3339)
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO fixed_expenses(name, year_month, category_id, amount, is_active, note, created_at, updated_at)
		 VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
		name, yearMonth, categoryID, amount, active, note, now, now,
	)
	return err
}

func (r *Repo) UpdateFixedExpense(ctx context.Context, id int64, name, yearMonth string, categoryID, amount int64, isActive bool, note string) error {
	active := 0
	if isActive {
		active = 1
	}
	res, err := r.db.ExecContext(ctx,
		`UPDATE fixed_expenses
		 SET name = ?, year_month = ?, category_id = ?, amount = ?, is_active = ?, note = ?, updated_at = ?
		 WHERE id = ?`,
		name, yearMonth, categoryID, amount, active, note, time.Now().Format(time.RFC3339), id,
	)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *Repo) DeleteFixedExpense(ctx context.Context, id int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM fixed_expenses WHERE id = ?`, id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

type IncomeFilter struct {
	Active *bool
	Name   string
}

func (r *Repo) Incomes(ctx context.Context, f IncomeFilter) ([]domain.Income, error) {
	q := `
SELECT i.id, i.name, i.year_month, i.amount, i.is_active, i.note
FROM incomes i
WHERE 1=1`
	args := make([]any, 0, 2)

	if f.Active != nil {
		q += " AND i.is_active = ?"
		if *f.Active {
			args = append(args, 1)
		} else {
			args = append(args, 0)
		}
	}
	if f.Name != "" {
		q += " AND i.name LIKE ?"
		args = append(args, "%"+f.Name+"%")
	}
	q += " ORDER BY i.name ASC, i.id ASC"

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]domain.Income, 0, 64)
	for rows.Next() {
		var item domain.Income
		var active int
		if err := rows.Scan(&item.ID, &item.Name, &item.YearMonth, &item.Amount, &active, &item.Note); err != nil {
			return nil, err
		}
		item.IsActive = active == 1
		list = append(list, item)
	}
	return list, rows.Err()
}

func (r *Repo) CreateIncome(ctx context.Context, name, yearMonth string, amount int64, isActive bool, note string) error {
	active := 0
	if isActive {
		active = 1
	}
	now := time.Now().Format(time.RFC3339)
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO incomes(name, year_month, amount, is_active, note, created_at, updated_at)
		 VALUES(?, ?, ?, ?, ?, ?, ?)`,
		name, yearMonth, amount, active, note, now, now,
	)
	return err
}

func (r *Repo) UpdateIncome(ctx context.Context, id int64, name, yearMonth string, amount int64, isActive bool, note string) error {
	active := 0
	if isActive {
		active = 1
	}
	res, err := r.db.ExecContext(ctx,
		`UPDATE incomes
		 SET name = ?, year_month = ?, amount = ?, is_active = ?, note = ?, updated_at = ?
		 WHERE id = ?`,
		name, yearMonth, amount, active, note, time.Now().Format(time.RFC3339), id,
	)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *Repo) DeleteIncome(ctx context.Context, id int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM incomes WHERE id = ?`, id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *Repo) ReplaceImportedFile(ctx context.Context, fileName, status, message string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO imported_files(file_name, imported_at, status, message)
		 VALUES(?, ?, ?, ?)
		 ON CONFLICT(file_name)
		 DO UPDATE SET imported_at=excluded.imported_at, status=excluded.status, message=excluded.message`,
		fileName,
		time.Now().Format(time.RFC3339),
		status,
		message,
	)
	return err
}

func (r *Repo) DeleteTransactionsBySourceFile(ctx context.Context, sourceFile string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM transactions WHERE source_file = ?`, sourceFile)
	return err
}

func (r *Repo) InsertTransactions(ctx context.Context, sourceFile string, records []csvimport.Record) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	stmt, err := tx.PrepareContext(ctx,
		`INSERT OR IGNORE INTO transactions(
			source_id, source_type, provider_name, account_name, occurred_at,
			use_date, year_month, direction, transaction_type,
			amount_in, amount_out, store_name, counterparty_name, merchant_name,
			description_raw, method, external_id, balance_after,
			amount, source_file, row_hash, created_at
		) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	now := time.Now().Format(time.RFC3339)
	sourceIDs := map[string]int64{}
	for _, rec := range records {
		sourceID, err := ensureSourceID(ctx, tx, sourceIDs, rec.SourceType, rec.ProviderName, rec.AccountName, now)
		if err != nil {
			return err
		}
		var balanceAfter any
		if rec.BalanceAfter != nil {
			balanceAfter = *rec.BalanceAfter
		}
		if _, err = stmt.ExecContext(ctx,
			sourceID,
			rec.SourceType,
			rec.ProviderName,
			rec.AccountName,
			rec.OccurredAt,
			rec.UseDate,
			rec.YearMonth,
			rec.Direction,
			rec.TransactionType,
			rec.AmountIn,
			rec.AmountOut,
			rec.StoreName,
			rec.CounterpartyName,
			rec.MerchantName,
			rec.DescriptionRaw,
			rec.Method,
			rec.ExternalID,
			balanceAfter,
			rec.Amount,
			sourceFile,
			rec.RowHash,
			now,
		); err != nil {
			return err
		}
	}
	if err = tx.Commit(); err != nil {
		return err
	}
	return nil
}

func ensureSourceID(ctx context.Context, tx *sql.Tx, cache map[string]int64, sourceType, providerName, accountName, now string) (int64, error) {
	key := sourceType + "\x00" + providerName + "\x00" + accountName
	if id, ok := cache[key]; ok {
		return id, nil
	}

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO transaction_sources(source_type, provider_name, account_name, is_active, created_at, updated_at)
		 VALUES(?, ?, ?, 1, ?, ?)
		 ON CONFLICT(source_type, provider_name, account_name)
		 DO UPDATE SET updated_at = excluded.updated_at`,
		sourceType, providerName, accountName, now, now,
	); err != nil {
		return 0, err
	}

	var id int64
	if err := tx.QueryRowContext(ctx,
		`SELECT id FROM transaction_sources WHERE source_type = ? AND provider_name = ? AND account_name = ?`,
		sourceType, providerName, accountName,
	).Scan(&id); err != nil {
		return 0, err
	}
	cache[key] = id
	return id, nil
}

func (r *Repo) ImportStatuses(ctx context.Context) ([]domain.ImportStatus, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT file_name, imported_at, status, message FROM imported_files ORDER BY file_name DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]domain.ImportStatus, 0, 64)
	for rows.Next() {
		var s domain.ImportStatus
		if err := rows.Scan(&s.FileName, &s.ImportedAt, &s.Status, &s.Message); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

func placeholders(n int) string {
	if n <= 0 {
		return ""
	}
	return strings.TrimRight(strings.Repeat("?,", n), ",")
}

func (r *Repo) Ping(ctx context.Context) error {
	if err := r.db.PingContext(ctx); err != nil {
		return fmt.Errorf("ping db: %w", err)
	}
	return nil
}
