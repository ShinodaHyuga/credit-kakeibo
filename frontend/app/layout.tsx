import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Credit Kakeibo",
  description: "支出管理アプリ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
