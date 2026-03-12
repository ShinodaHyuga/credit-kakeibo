package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"
)

var fixedCategories = []string{
	"住居費",
	"食費",
	"交通費",
	"医療・美容・衣類",
	"生活用品",
	"コンビニ",
	"サブスク",
	"娯楽・交際",
	"投資",
	"その他",
	"振込",
	"未分類",
}

func Open(dbPath string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return nil, fmt.Errorf("create db dir: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	if err := migrate(db); err != nil {
		_ = db.Close()
		return nil, err
	}
	if err := seedCategories(db); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}

func migrate(db *sql.DB) error {
	stmts := []string{
		`PRAGMA foreign_keys = ON;`,
		`CREATE TABLE IF NOT EXISTS transaction_sources (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			source_type TEXT NOT NULL,
			provider_name TEXT NOT NULL,
			account_name TEXT NOT NULL DEFAULT '',
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			UNIQUE(source_type, provider_name, account_name)
		);`,
		`CREATE TABLE IF NOT EXISTS categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			sort_order INTEGER NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS category_match_rules (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			match_text TEXT NOT NULL UNIQUE,
			category_id INTEGER NOT NULL,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY (category_id) REFERENCES categories(id)
		);`,
		`CREATE TABLE IF NOT EXISTS transactions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			use_date TEXT NOT NULL,
			year_month TEXT NOT NULL,
			store_name TEXT NOT NULL,
			amount INTEGER NOT NULL,
			source_file TEXT NOT NULL,
			row_hash TEXT NOT NULL,
			created_at TEXT NOT NULL,
			UNIQUE(source_file, row_hash)
		);`,
		`CREATE TABLE IF NOT EXISTS classification_rules (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			rule_name TEXT NOT NULL DEFAULT '',
			source_type TEXT NOT NULL DEFAULT '',
			provider_name TEXT NOT NULL DEFAULT '',
			direction TEXT NOT NULL DEFAULT '',
			transaction_type TEXT NOT NULL DEFAULT '',
			counterparty_match TEXT NOT NULL DEFAULT '',
			merchant_match TEXT NOT NULL DEFAULT '',
			description_match TEXT NOT NULL DEFAULT '',
			method_match TEXT NOT NULL DEFAULT '',
			category_id INTEGER NOT NULL,
			priority INTEGER NOT NULL DEFAULT 100,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY (category_id) REFERENCES categories(id)
		);`,
		`CREATE TABLE IF NOT EXISTS transaction_category_overrides (
			transaction_id INTEGER PRIMARY KEY,
			category_id INTEGER NOT NULL,
			note TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY (transaction_id) REFERENCES transactions(id),
			FOREIGN KEY (category_id) REFERENCES categories(id)
		);`,
		`CREATE TABLE IF NOT EXISTS imported_files (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			file_name TEXT NOT NULL UNIQUE,
			imported_at TEXT NOT NULL,
			status TEXT NOT NULL,
			message TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS fixed_expenses (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			year_month TEXT NOT NULL DEFAULT '',
			category_id INTEGER NOT NULL,
			amount INTEGER NOT NULL,
			is_active INTEGER NOT NULL DEFAULT 1,
			note TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY (category_id) REFERENCES categories(id)
		);`,
		`CREATE TABLE IF NOT EXISTS incomes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			year_month TEXT NOT NULL,
			amount INTEGER NOT NULL,
			is_active INTEGER NOT NULL DEFAULT 1,
			note TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_year_month ON transactions(year_month);`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_store_name ON transactions(store_name);`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_source_file ON transactions(source_file);`,
		`CREATE INDEX IF NOT EXISTS idx_category_match_rules_category_id ON category_match_rules(category_id);`,
		`CREATE INDEX IF NOT EXISTS idx_category_match_rules_active ON category_match_rules(is_active);`,
		`CREATE INDEX IF NOT EXISTS idx_classification_rules_category_id ON classification_rules(category_id);`,
		`CREATE INDEX IF NOT EXISTS idx_classification_rules_active ON classification_rules(is_active);`,
		`CREATE INDEX IF NOT EXISTS idx_fixed_expenses_active ON fixed_expenses(is_active);`,
		`CREATE INDEX IF NOT EXISTS idx_incomes_active ON incomes(is_active);`,
	}

	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}
	if err := ensureFixedExpenseColumns(db); err != nil {
		return err
	}
	if err := ensureTransactionColumns(db); err != nil {
		return err
	}
	if err := ensureTransactionIndexes(db); err != nil {
		return err
	}
	if err := ensureClassificationRuleIndexes(db); err != nil {
		return err
	}
	if err := ensureCategoryRename(db, "インフラ", "住居費"); err != nil {
		return err
	}
	if err := ensureLegacyCategoryRulesMigrated(db); err != nil {
		return err
	}
	return nil
}

func ensureFixedExpenseColumns(db *sql.DB) error {
	rows, err := db.Query(`PRAGMA table_info(fixed_expenses)`)
	if err != nil {
		return fmt.Errorf("table_info fixed_expenses: %w", err)
	}
	defer rows.Close()

	hasYearMonth := false
	for rows.Next() {
		var (
			cid       int
			name      string
			colType   string
			notNull   int
			dfltValue sql.NullString
			pk        int
		)
		if err := rows.Scan(&cid, &name, &colType, &notNull, &dfltValue, &pk); err != nil {
			return fmt.Errorf("scan table_info: %w", err)
		}
		if strings.EqualFold(name, "year_month") {
			hasYearMonth = true
			break
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("table_info rows: %w", err)
	}
	if hasYearMonth {
		return nil
	}
	if _, err := db.Exec(`ALTER TABLE fixed_expenses ADD COLUMN year_month TEXT NOT NULL DEFAULT ''`); err != nil {
		return fmt.Errorf("add year_month: %w", err)
	}
	return nil
}

func ensureTransactionColumns(db *sql.DB) error {
	required := []struct {
		name       string
		definition string
	}{
		{name: "source_id", definition: `INTEGER REFERENCES transaction_sources(id)`},
		{name: "source_type", definition: `TEXT NOT NULL DEFAULT ''`},
		{name: "provider_name", definition: `TEXT NOT NULL DEFAULT ''`},
		{name: "account_name", definition: `TEXT NOT NULL DEFAULT ''`},
		{name: "occurred_at", definition: `TEXT NOT NULL DEFAULT ''`},
		{name: "direction", definition: `TEXT NOT NULL DEFAULT ''`},
		{name: "transaction_type", definition: `TEXT NOT NULL DEFAULT ''`},
		{name: "amount_in", definition: `INTEGER NOT NULL DEFAULT 0`},
		{name: "amount_out", definition: `INTEGER NOT NULL DEFAULT 0`},
		{name: "counterparty_name", definition: `TEXT NOT NULL DEFAULT ''`},
		{name: "merchant_name", definition: `TEXT NOT NULL DEFAULT ''`},
		{name: "description_raw", definition: `TEXT NOT NULL DEFAULT ''`},
		{name: "method", definition: `TEXT NOT NULL DEFAULT ''`},
		{name: "external_id", definition: `TEXT NOT NULL DEFAULT ''`},
		{name: "balance_after", definition: `INTEGER`},
	}

	existing, err := tableColumns(db, "transactions")
	if err != nil {
		return err
	}
	for _, col := range required {
		if existing[strings.ToLower(col.name)] {
			continue
		}
		if _, err := db.Exec(`ALTER TABLE transactions ADD COLUMN ` + col.name + ` ` + col.definition); err != nil {
			return fmt.Errorf("add transactions.%s: %w", col.name, err)
		}
	}
	return nil
}

func ensureTransactionIndexes(db *sql.DB) error {
	stmts := []string{
		`CREATE INDEX IF NOT EXISTS idx_transactions_source_id ON transactions(source_id);`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_source_type ON transactions(source_type);`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_provider_name ON transactions(provider_name);`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_transaction_type ON transactions(transaction_type);`,
	}
	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("transaction index: %w", err)
		}
	}
	return nil
}

func ensureClassificationRuleIndexes(db *sql.DB) error {
	stmts := []string{
		`CREATE INDEX IF NOT EXISTS idx_classification_rules_source_type ON classification_rules(source_type);`,
		`CREATE INDEX IF NOT EXISTS idx_classification_rules_provider_name ON classification_rules(provider_name);`,
		`CREATE INDEX IF NOT EXISTS idx_classification_rules_description_match ON classification_rules(description_match);`,
	}
	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("classification rule index: %w", err)
		}
	}
	return nil
}

func ensureLegacyCategoryRulesMigrated(db *sql.DB) error {
	_, err := db.Exec(`
INSERT INTO classification_rules(
	rule_name,
	source_type,
	provider_name,
	direction,
	transaction_type,
	counterparty_match,
	merchant_match,
	description_match,
	method_match,
	category_id,
	priority,
	is_active,
	created_at,
	updated_at
)
SELECT
	'legacy:' || r.match_text,
	'',
	'',
	'',
	'',
	'',
	'',
	r.match_text,
	'',
	r.category_id,
	100,
	r.is_active,
	r.created_at,
	r.updated_at
FROM category_match_rules r
WHERE NOT EXISTS (
	SELECT 1
	FROM classification_rules cr
	WHERE cr.source_type = ''
	  AND cr.provider_name = ''
	  AND cr.direction = ''
	  AND cr.transaction_type = ''
	  AND cr.counterparty_match = ''
	  AND cr.merchant_match = ''
	  AND cr.description_match = r.match_text
	  AND cr.method_match = ''
);`)
	if err != nil {
		return fmt.Errorf("migrate legacy category rules: %w", err)
	}
	return nil
}

func tableColumns(db *sql.DB, table string) (map[string]bool, error) {
	rows, err := db.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		return nil, fmt.Errorf("table_info %s: %w", table, err)
	}
	defer rows.Close()

	cols := map[string]bool{}
	for rows.Next() {
		var (
			cid       int
			name      string
			colType   string
			notNull   int
			dfltValue sql.NullString
			pk        int
		)
		if err := rows.Scan(&cid, &name, &colType, &notNull, &dfltValue, &pk); err != nil {
			return nil, fmt.Errorf("scan table_info %s: %w", table, err)
		}
		cols[strings.ToLower(name)] = true
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("table_info rows %s: %w", table, err)
	}
	return cols, nil
}

func seedCategories(db *sql.DB) error {
	for i, name := range fixedCategories {
		if _, err := db.Exec(
			`INSERT INTO categories(name, sort_order) VALUES(?, ?)
			 ON CONFLICT(name) DO UPDATE SET sort_order=excluded.sort_order`,
			name, i+1,
		); err != nil {
			return fmt.Errorf("seed category %s: %w", name, err)
		}
	}
	return nil
}

func ensureCategoryRename(db *sql.DB, oldName, newName string) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("begin rename category tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var oldID int64
	err = tx.QueryRow(`SELECT id FROM categories WHERE name = ?`, oldName).Scan(&oldID)
	if err == sql.ErrNoRows {
		return tx.Commit()
	}
	if err != nil {
		return fmt.Errorf("find old category %s: %w", oldName, err)
	}

	var newID int64
	err = tx.QueryRow(`SELECT id FROM categories WHERE name = ?`, newName).Scan(&newID)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("find new category %s: %w", newName, err)
	}

	if err == sql.ErrNoRows {
		if _, err := tx.Exec(`UPDATE categories SET name = ? WHERE id = ?`, newName, oldID); err != nil {
			return fmt.Errorf("rename category %s -> %s: %w", oldName, newName, err)
		}
		return tx.Commit()
	}

	if _, err := tx.Exec(`UPDATE category_match_rules SET category_id = ? WHERE category_id = ?`, newID, oldID); err != nil {
		return fmt.Errorf("move rules category id %d -> %d: %w", oldID, newID, err)
	}
	if _, err := tx.Exec(`UPDATE fixed_expenses SET category_id = ? WHERE category_id = ?`, newID, oldID); err != nil {
		return fmt.Errorf("move fixed_expenses category id %d -> %d: %w", oldID, newID, err)
	}
	if _, err := tx.Exec(`DELETE FROM categories WHERE id = ?`, oldID); err != nil {
		return fmt.Errorf("delete old category id %d: %w", oldID, err)
	}
	return tx.Commit()
}
