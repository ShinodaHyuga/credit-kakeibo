# credit-kakeibo

ローカル専用の支出管理アプリです。  
クレジットカードCSVを取り込み、カテゴリ判定・月次集計・固定支出管理を行います。

**三井住友カード**の利用を想定しています。

## 技術構成

- Frontend: Next.js + TypeScript
- Backend: Go
- DB: SQLite

## 主な機能

- 明細一覧（検索・ソート・未分類抽出）
- 支出（月次カテゴリ集計）
- カテゴリ管理（`match_text` の部分一致ルール）
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
- 文字コード: `Shift_JIS`
- 1行目はヘッダーとしてスキップ
- 末尾の集計行は取り込み対象外
