package csvimport

import (
	"bufio"
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

var filePattern = regexp.MustCompile(`^(\d{6}|meisai|Transactions_\d{8}-\d{8})\.csv$`)
var meisaiDebitPattern = regexp.MustCompile(`^V\d{6}`)

type Record struct {
	SourceType       string
	ProviderName     string
	AccountName      string
	OccurredAt       string
	UseDate          string
	YearMonth        string
	Direction        string
	TransactionType  string
	AmountIn         int64
	AmountOut        int64
	Amount           int64
	StoreName        string
	CounterpartyName string
	MerchantName     string
	DescriptionRaw   string
	Method           string
	ExternalID       string
	BalanceAfter     *int64
	RowHash          string
}

type fileFormat string

const (
	formatCreditCard fileFormat = "credit_card"
	formatBank       fileFormat = "bank"
	formatPayPay     fileFormat = "paypay"
)

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

	format := detectFormat(path)
	reader := csv.NewReader(newCSVReader(f, format))
	reader.FieldsPerRecord = -1

	line := 0
	accountName := ""
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
		row = normalizeRow(row)
		if line == 1 {
			switch format {
			case formatCreditCard:
				if isCreditCardMetaRow(row) {
					if len(row) > 2 {
						accountName = strings.TrimSpace(row[2])
					}
					continue
				}
			case formatBank, formatPayPay:
				continue
			}
		}
		if isBlankRow(row) {
			continue
		}
		if isTrailingSummaryRow(row) {
			continue
		}
		if format == formatBank && !hasNonZeroMeisaiAmount(row) {
			// Skip rows with neither withdrawal nor deposit amount, or both zero.
			continue
		}
		rec := parseRow(row, format, accountName)
		records = append(records, rec)
	}
	return records, nil
}

func parseRow(row []string, format fileFormat, accountName string) Record {
	raw := strings.Join(row, "|")
	h := sha1.Sum([]byte(raw))
	rec := Record{RowHash: hex.EncodeToString(h[:])}

	switch format {
	case formatBank:
		rec = parseBankRow(row)
	case formatPayPay:
		rec = parsePayPayRow(row)
	default:
		rec = parseCreditCardRow(row, accountName)
	}
	rec.RowHash = hex.EncodeToString(h[:])
	return rec
}

func newCSVReader(f *os.File, format fileFormat) io.Reader {
	if format == formatPayPay {
		return bufio.NewReader(f)
	}
	return transform.NewReader(f, japanese.ShiftJIS.NewDecoder())
}

func detectFormat(path string) fileFormat {
	name := filepath.Base(path)
	switch {
	case strings.EqualFold(name, "meisai.csv"):
		return formatBank
	case strings.HasPrefix(name, "Transactions_"):
		return formatPayPay
	default:
		return formatCreditCard
	}
}

func normalizeRow(row []string) []string {
	for i := range row {
		row[i] = strings.TrimPrefix(row[i], "\uFEFF")
	}
	return row
}

func isCreditCardMetaRow(row []string) bool {
	return len(row) == 3 && strings.Contains(strings.TrimSpace(row[0]), "様")
}

func parseCreditCardRow(row []string, accountName string) Record {
	useDate, yearMonth := normalizeDate(firstCell(row, 0))
	merchantName := strings.TrimSpace(firstCell(row, 1))
	amountOut, _ := parseAmount(normalizeAmount(firstCell(row, 2)))
	storeName := merchantName
	if storeName == "" {
		storeName = "null"
	}
	return Record{
		SourceType:       "credit_card",
		ProviderName:     "三井住友カード",
		AccountName:      accountName,
		OccurredAt:       useDate,
		UseDate:          useDate,
		YearMonth:        yearMonth,
		Direction:        "expense",
		TransactionType:  "payment",
		AmountOut:        amountOut,
		Amount:           amountOut,
		StoreName:        storeName,
		CounterpartyName: merchantName,
		MerchantName:     merchantName,
		DescriptionRaw:   merchantName,
	}
}

func parseBankRow(row []string) Record {
	useDate, yearMonth := normalizeDate(firstCell(row, 0))
	amountOut, _ := parseAmount(normalizeAmount(firstCell(row, 1)))
	amountIn, _ := parseAmount(normalizeAmount(firstCell(row, 2)))
	description := strings.TrimSpace(firstCell(row, 3))
	storeName := normalizeMeisaiStoreName(description)
	if storeName == "" {
		storeName = "null"
	}

	rec := Record{
		SourceType:       "bank",
		ProviderName:     "三井住友銀行",
		OccurredAt:       useDate,
		UseDate:          useDate,
		YearMonth:        yearMonth,
		AmountIn:         amountIn,
		AmountOut:        amountOut,
		Amount:           amountOut - amountIn,
		StoreName:        storeName,
		CounterpartyName: description,
		DescriptionRaw:   description,
	}
	rec.Direction, rec.TransactionType = inferBankClassification(description, amountOut, amountIn)
	if balance, ok := parseAmount(normalizeAmount(firstCell(row, 4))); ok {
		rec.BalanceAfter = &balance
	}
	return rec
}

func parsePayPayRow(row []string) Record {
	occurredAt, useDate, yearMonth := normalizeDateTime(firstCell(row, 0))
	amountOut, _ := parseAmount(normalizeAmount(firstCell(row, 1)))
	amountIn, _ := parseAmount(normalizeAmount(firstCell(row, 2)))
	transactionLabel := strings.TrimSpace(firstCell(row, 7))
	counterparty := strings.TrimSpace(firstCell(row, 8))
	method := strings.TrimSpace(firstCell(row, 9))
	externalID := strings.TrimSpace(firstCell(row, 12))
	transactionType, direction := inferPayPayClassification(transactionLabel, amountOut, amountIn)
	storeName := counterparty
	if storeName == "" {
		storeName = transactionLabel
	}
	if storeName == "" {
		storeName = "null"
	}

	return Record{
		SourceType:       "paypay",
		ProviderName:     "PayPay",
		OccurredAt:       occurredAt,
		UseDate:          useDate,
		YearMonth:        yearMonth,
		Direction:        direction,
		TransactionType:  transactionType,
		AmountIn:         amountIn,
		AmountOut:        amountOut,
		Amount:           amountOut - amountIn,
		StoreName:        storeName,
		CounterpartyName: counterparty,
		MerchantName:     counterparty,
		DescriptionRaw:   transactionLabel,
		Method:           method,
		ExternalID:       externalID,
	}
}

func firstCell(row []string, idx int) string {
	if idx >= len(row) {
		return ""
	}
	return row[idx]
}

func hasNonZeroMeisaiAmount(row []string) bool {
	if len(row) < 3 {
		return false
	}
	withdrawal := strings.ReplaceAll(strings.TrimSpace(row[1]), ",", "")
	if v, ok := parseAmount(withdrawal); ok && v != 0 {
		return true
	}
	deposit := strings.ReplaceAll(strings.TrimSpace(row[2]), ",", "")
	if v, ok := parseAmount(deposit); ok && v != 0 {
		return true
	}
	return false
}

func parseMeisaiAmount(row []string) int64 {
	if len(row) > 1 {
		a := strings.ReplaceAll(strings.TrimSpace(row[1]), ",", "")
		if parsed, ok := parseAmount(a); ok {
			return parsed
		}
	}
	if len(row) > 2 {
		a := strings.ReplaceAll(strings.TrimSpace(row[2]), ",", "")
		if parsed, ok := parseAmount(a); ok {
			return parsed
		}
	}
	return 0
}

func parseAmount(s string) (int64, bool) {
	if s == "" {
		return 0, false
	}
	parsed, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0, false
	}
	return parsed, true
}

func normalizeAmount(s string) string {
	s = strings.ReplaceAll(strings.TrimSpace(s), ",", "")
	if s == "-" {
		return ""
	}
	return s
}

func normalizeMeisaiStoreName(raw string) string {
	s := strings.TrimSpace(raw)
	switch {
	case meisaiDebitPattern.MatchString(s):
		return "デビット"
	case strings.Contains(s, "PAYPAYｶ-ﾄﾞ"):
		return "paypayカードの支払い"
	case strings.Contains(s, "パソコン振込 ｶ)ｼﾃｲ-ﾌﾟﾗﾝﾆﾝｸﾞ"):
		return "家賃"
	default:
		return s
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

func normalizeDateTime(s string) (string, string, string) {
	s = strings.TrimSpace(s)
	if len(s) >= len("2006/01/02 15:04:05") {
		datePart := s[:10]
		useDate, ym := normalizeDate(datePart)
		if useDate != "null" {
			return strings.ReplaceAll(s, "/", "-"), useDate, ym
		}
	}
	useDate, ym := normalizeDate(s)
	return useDate, useDate, ym
}

func inferBankClassification(description string, amountOut, amountIn int64) (string, string) {
	switch {
	case amountIn > 0 && strings.HasPrefix(description, "給料振込"):
		return "income", "salary"
	case amountIn > 0 && strings.HasPrefix(description, "賞与振込"):
		return "income", "bonus"
	case amountIn > 0 && strings.Contains(description, "利息"):
		return "income", "interest"
	case amountIn > 0:
		return "income", "deposit"
	case strings.HasPrefix(description, "パソコン振込"), strings.HasPrefix(description, "振込"):
		return "transfer", "bank_transfer"
	case strings.Contains(description, "PAYPAY"):
		return "transfer", "paypay_settlement"
	case strings.Contains(description, "ﾐﾂｲｽﾐﾄﾓｶ-ﾄﾞ"):
		return "transfer", "card_settlement"
	case strings.HasPrefix(description, "V"):
		return "expense", "debit_payment"
	default:
		return "expense", "withdrawal"
	}
}

func inferPayPayClassification(transactionLabel string, amountOut, amountIn int64) (string, string) {
	switch transactionLabel {
	case "支払い":
		return "payment", "expense"
	case "送った金額":
		return "send", "transfer"
	case "受け取った金額":
		return "receive", "income"
	case "チャージ":
		return "charge", "transfer"
	case "返金":
		return "refund", "refund"
	case "ポイント、残高の獲得", "ポイント、残高の取消":
		return "point", "point"
	default:
		if amountIn > 0 {
			return "deposit", "income"
		}
		return "payment", "expense"
	}
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
