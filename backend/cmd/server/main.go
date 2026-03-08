package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"credit-kakeibo/backend/internal/db"
	"credit-kakeibo/backend/internal/handler"
	"credit-kakeibo/backend/internal/repository"
	"credit-kakeibo/backend/internal/service"
)

func main() {
	var (
		addr    = flag.String("addr", ":8080", "listen address")
		dbPath  = flag.String("db", "./app.db", "sqlite db path")
		dataDir = flag.String("data", "../data", "csv data directory")
		logPath = flag.String("log", "../logs/error.log", "error log path")
	)
	flag.Parse()

	if err := os.MkdirAll(filepath.Dir(*logPath), 0o755); err != nil {
		log.Fatalf("mkdir logs: %v", err)
	}
	lf, err := os.OpenFile(*logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		log.Fatalf("open log file: %v", err)
	}
	defer lf.Close()

	errLogger := log.New(lf, "", log.LstdFlags)

	sqliteDB, err := db.Open(*dbPath)
	if err != nil {
		log.Fatalf("db open: %v", err)
	}
	defer sqliteDB.Close()

	repo := repository.New(sqliteDB)
	svc := service.New(repo, errLogger, *dataDir)
	h := handler.New(svc)

	mux := http.NewServeMux()
	h.Register(mux)

	log.Printf("server started: http://localhost%s", *addr)
	if err := http.ListenAndServe(*addr, mux); err != nil {
		log.Fatalf("listen: %v", err)
	}
}
