# credit-kakeibo

ローカル専用の収支管理アプリです。  
クレジットカード・銀行・PayPay のCSVを取り込み、カテゴリ判定・月次集計・固定支出管理を行います。

## 技術構成

- Frontend: Next.js + TypeScript
- Backend: Go
- DB: SQLite

## 主な機能

- 明細一覧（検索・ソート・未分類抽出）
- 支出（月次カテゴリ集計）
- カテゴリ管理（source/provider/type を含む分類ルール）
- 固定支出管理（利用年月つき）
- CSV再読み込み

## 起動方法

### 1. Backend

```bash
cd backend
go run ./cmd/server -addr :8080
```

### 2. Frontend

別ターミナルで:

```bash
cd frontend
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。  
フロントから `/api/*` はバックエンド（`http://localhost:8080`）へプロキシされます。

## CSVについて

- 取込元ディレクトリ: `data/`
- 対応ファイル:
  - `YYYYMM.csv` : 三井住友カード
  - `meisai.csv` : 三井住友銀行
  - `Transactions_YYYYMMDD-YYYYMMDD.csv` : PayPay
- 文字コード:
  - 三井住友カード / 三井住友銀行: `Shift_JIS`
  - PayPay: `UTF-8`
- 先頭ヘッダーや末尾集計行は自動でスキップ

## やらないといけないこと

- クレカの利用明細をダウンロードして `data/` に置く
- 銀行の明細をダウンロードして `data/` に置く
