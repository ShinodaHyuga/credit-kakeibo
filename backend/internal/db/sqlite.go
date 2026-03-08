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
	"インフラ",
	"コンビニ",
	"サブスク",
	"投資",
	"医療・美容・衣類",
	"娯楽・交際",
	"交通費",
	"食費",
	"生活用品",
	"その他",
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
