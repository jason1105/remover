import { NextResponse } from "next/server";
import { db, slug } from "@/lib/store";
import { fetchArticleText } from "@/lib/fetcher";
import { summarizeInChinese, translateToChinese } from "@/lib/llm";

export const dynamic = "force-dynamic";

/**
 * 处理帖子的工人 (Processor worker)
 * - 读取已收集但未处理的文章
 * - 抓取正文, 用中文总结, 整篇翻译
 * - 生成子目录命名 <date>-<title> 与封面图引用
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(10, Number(body.limit ?? 3)));
  const data = db();

  const pending = data.articles.filter((a) => !a.processed).slice(0, limit);
  const results = [];

  for (const a of pending) {
    const text = await fetchArticleText(a.url);
    a.summary = await summarizeInChinese(a.title, text);
    if (body.translate) {
      a.translation = await translateToChinese(text);
    }
    a.image = `https://picsum.photos/seed/${encodeURIComponent(a.id)}/800/420`;
    a.processed = true;
    const dir = `${a.collectedAt}-${slug(a.title)}`;
    results.push({ id: a.id, dir, files: [`${dir}.txt`, `${dir}.png`], summary: a.summary });
  }

  return NextResponse.json({ ok: true, processedCount: results.length, results });
}
