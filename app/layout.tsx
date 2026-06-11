import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Remover · 内容聚合发布流水线",
  description: "自动获取、翻译、总结并发布文章的工作流仪表盘",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
