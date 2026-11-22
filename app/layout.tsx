import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "탑 등반 RPG",
  description: "탑을 오르는 로그라이크 턴제 RPG",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
