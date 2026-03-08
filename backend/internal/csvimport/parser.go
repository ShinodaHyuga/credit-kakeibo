package csvimport

import (
	"crypto/sha1"
	"encoding/csv"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/transform"
)

var filePattern = regexp.MustCompile(`^\d{6}\.csv$`)

type Record struct {
	UseDate   string
	YearMonth string
	StoreName string
	Amount    int64
	RowHash   string
}

func ListTargetFiles(dataDir string) ([]string, error) {
	entries, err := os.ReadDir(dataDir)
	if err != nil {
		return nil, fmt.Errorf("read data dir: %w", err)
	}

	files := make([]string, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if filePattern.MatchString(e.Name()) {
			files = append(files, filepath.Join(dataDir, e.Name()))
		}
	}
	return files, nil
}

func ParseFile(path string) ([]Record, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open csv: %w", err)
	}
	defer f.Close()

	reader := csv.NewReader(transform.NewReader(f, japanese.ShiftJIS.NewDecoder()))
	reader.FieldsPerRecord = -1

	line := 0
	records := make([]Record, 0, 128)
	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("read csv row: %w", err)
		}
		line++
		if line == 1 {
			continue
		}
		if isBlankRow(row) {
			continue
		}
		if isTrailingSummaryRow(row) {
			continue
		}
		rec := parseRow(row)
		records = append(records, rec)
	}
	return records, nil
}

func parseRow(row []string) Record {
	useDate := "null"
	yearMonth := "null"
	storeName := "null"
	var amount int64

	if len(row) > 0 {
		useDate, yearMonth = normalizeDate(row[0])
	}
	if len(row) > 1 && strings.TrimSpace(row[1]) != "" {
		storeName = strings.TrimSpace(row[1])
	}
	if len(row) > 2 {
		a := strings.ReplaceAll(strings.TrimSpace(row[2]), ",", "")
		if parsed, err := strconv.ParseInt(a, 10, 64); err == nil {
			amount = parsed
		}
	}

	raw := strings.Join(row, "|")
	h := sha1.Sum([]byte(raw))
	return Record{
		UseDate:   useDate,
		YearMonth: yearMonth,
		StoreName: storeName,
		Amount:    amount,
		RowHash:   hex.EncodeToString(h[:]),
	}
}

func normalizeDate(s string) (string, string) {
	parts := strings.Split(strings.TrimSpace(s), "/")
	if len(parts) != 3 {
		return "null", "null"
	}
	if len(parts[0]) != 4 || len(parts[1]) == 0 || len(parts[2]) == 0 {
		return "null", "null"
	}
	mi, err := strconv.Atoi(parts[1])
	if err != nil {
		return "null", "null"
	}
	di, err := strconv.Atoi(parts[2])
	if err != nil {
		return "null", "null"
	}
	m := fmt.Sprintf("%02d", mi)
	d := fmt.Sprintf("%02d", di)
	date := parts[0] + "-" + m + "-" + d
	ym := parts[0] + "-" + m
	return date, ym
}

func isBlankRow(row []string) bool {
	for _, col := range row {
		if strings.TrimSpace(col) != "" {
			return false
		}
	}
	return true
}

// Skip footer summary rows such as: ",,,,,149307,"
func isTrailingSummaryRow(row []string) bool {
	if len(row) == 0 {
		return false
	}
	// Detail rows always have a date in the first column.
	if strings.TrimSpace(row[0]) != "" {
		return false
	}
	// If any later column has a value, treat it as a non-detail summary/footer row.
	for i := 1; i < len(row); i++ {
		if strings.TrimSpace(row[i]) != "" {
			return true
		}
	}
	return false
}
