package csvimport

import (
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/transform"
)

func TestParseFile_MeisaiIncludesDepositRows(t *testing.T) {
	t.Parallel()

	csvUTF8 := `年月日,お引出し,お預入れ,お取り扱い内容,残高,メモ,ラベル
2026/2/27,19277,,"PAYPAYｶ-ﾄﾞ",836420,"",
2026/2/25,,281450,"給料振込　SBAW(ｶ)ｿﾌﾄﾊﾞﾝｸ.ｶ",1186063,"",
,,,,149307,,
`
	path := writeShiftJISCSV(t, csvUTF8)

	records, err := ParseFile(path)
	if err != nil {
		t.Fatalf("ParseFile() error = %v", err)
	}
	if len(records) != 2 {
		t.Fatalf("len(records) = %d, want 2", len(records))
	}

	if records[0].StoreName != "paypayカードの支払い" {
		t.Fatalf("records[0].StoreName = %q, want %q", records[0].StoreName, "paypayカードの支払い")
	}
	if records[0].Amount != 19277 {
		t.Fatalf("records[0].Amount = %d, want 19277", records[0].Amount)
	}

	if records[1].StoreName != "給料振込　SBAW(ｶ)ｿﾌﾄﾊﾞﾝｸ.ｶ" {
		t.Fatalf("records[1].StoreName = %q, want %q", records[1].StoreName, "給料振込　SBAW(ｶ)ｿﾌﾄﾊﾞﾝｸ.ｶ")
	}
	if records[1].Amount != 281450 {
		t.Fatalf("records[1].Amount = %d, want 281450", records[1].Amount)
	}
}

func TestParseMeisaiAmount(t *testing.T) {
	t.Parallel()

	if got := parseMeisaiAmount([]string{"2026/2/25", "", "281450"}); got != 281450 {
		t.Fatalf("parseMeisaiAmount(deposit) = %d, want 281450", got)
	}
	if got := parseMeisaiAmount([]string{"2026/2/25", "110000", ""}); got != 110000 {
		t.Fatalf("parseMeisaiAmount(withdrawal) = %d, want 110000", got)
	}
}

func TestParseFile_MeisaiSkipsZeroAmountRows(t *testing.T) {
	t.Parallel()

	csvUTF8 := `年月日,お引出し,お預入れ,お取り扱い内容,残高,メモ,ラベル
2026/2/27,0,,"",836420,"",
2026/2/26,,0,"",836420,"",
2026/2/25,100,,"V222180",836320,"",
`
	path := writeShiftJISCSV(t, csvUTF8)

	records, err := ParseFile(path)
	if err != nil {
		t.Fatalf("ParseFile() error = %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("len(records) = %d, want 1", len(records))
	}
	if records[0].Amount != 100 {
		t.Fatalf("records[0].Amount = %d, want 100", records[0].Amount)
	}
}

func writeShiftJISCSV(t *testing.T, csvUTF8 string) string {
	t.Helper()

	encoded, _, err := transform.String(japanese.ShiftJIS.NewEncoder(), csvUTF8)
	if err != nil {
		t.Fatalf("encode shift-jis: %v", err)
	}

	dir := t.TempDir()
	path := filepath.Join(dir, "meisai.csv")
	if err := os.WriteFile(path, []byte(encoded), 0o644); err != nil {
		t.Fatalf("write csv: %v", err)
	}
	return path
}
