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

func (r *Repo) Transactions(ctx context.Context, f TransactionFilter) ([]domain.Transaction, error) {
	base := `
SELECT t.id, t.use_date, t.year_month, t.store_name,
       COALESCE(c.name, '未分類') AS category,
       t.amount,
       r.id AS applied_rule_id
FROM transactions t` + ruleJoinClause() + `
WHERE 1=1`

	args := make([]any, 0, 10)
	if len(f.Months) > 0 {
		base += " AND t.year_month IN (" + placeholders(len(f.Months)) + ")"
		for _, m := range f.Months {
			args = append(args, m)
		}
	}
	if f.Uncategorized {
		base += " AND r.id IS NULL"
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
		if err := rows.Scan(&t.ID, &t.UseDate, &t.YearMonth, &t.StoreName, &t.Category, &t.Amount, &ruleID); err != nil {
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
SELECT t.year_month, COALESCE(c.name, '未分類') AS category, SUM(t.amount)
FROM transactions t` + ruleJoinClause() + `
WHERE 1=1`
	args := make([]any, 0, 8)

	if len(months) > 0 {
		q += " AND t.year_month IN (" + placeholders(len(months)) + ")"
		for _, m := range months {
			args = append(args, m)
		}
	}
	if from != "" {
		q += " AND t.year_month >= ?"
		args = append(args, from)
	}
	if to != "" {
		q += " AND t.year_month <= ?"
		args = append(args, to)
	}
	q += " GROUP BY t.year_month, category ORDER BY t.year_month ASC"

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

func (r *Repo) CreateCategoryRule(ctx context.Context, matchText string, categoryID int64, isActive bool) error {
	active := 0
	if isActive {
		active = 1
	}
	now := time.Now().Format(time.RFC3339)
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO category_match_rules(match_text, category_id, is_active, created_at, updated_at)
		 VALUES(?, ?, ?, ?, ?)`,
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

func (r *Repo) UncategorizedStores(ctx context.Context, storeName string) ([]domain.UncategorizedStore, error) {
	q := `
SELECT DISTINCT t.store_name
FROM transactions t
WHERE NOT EXISTS (
	SELECT 1 FROM category_match_rules r
	WHERE r.is_active = 1
	  AND instr(t.store_name, r.match_text) > 0
)`
	args := make([]any, 0, 1)
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
		`INSERT OR IGNORE INTO transactions(use_date, year_month, store_name, amount, source_file, row_hash, created_at)
		 VALUES(?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	now := time.Now().Format(time.RFC3339)
	for _, rec := range records {
		if _, err = stmt.ExecContext(ctx,
			rec.UseDate,
			rec.YearMonth,
			rec.StoreName,
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
