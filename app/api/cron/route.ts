import { NextResponse } from "next/server";
import { db, uid, today, enforceRetention, slug } from "@/lib/store";
import { fetchPopular, fetchArticleText } from "@/lib/fetcher";
import { classify, summarizeInChinese } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 每天定时执行的全流水线 (Vercel Cron → vercel.json)。
 * 收集 → 处理(总结) → 发布，对应 README 里三个工人的串联。
 *
 * 可选用 CRON_SECRET 保护：Vercel Cron 会带上 `Authorization: Bearer <CRON_SECRET>`。
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const data = db();
  const date = today();

  // 1) 收集
  const items = await fetchPopular(data.rules.topic, 6);
  let collected = 0;
  for (const item of items) {
    if (data.articles.some((a) => a.url === item.url)) continue;
    const category = await classify(item.title, item.title, data.categories);
    data.articles.push({
      id: uid("a"), title: item.title, url: item.url, source: "cron",
      category, collectedAt: date, processed: false,
    });
    collected++;
  }
  enforceRetention();

  // 2) 处理 (总结)
  const pending = data.articles.filter((a) => !a.processed).slice(0, 5);
  for (const a of pending) {
    const text = await fetchArticleText(a.url);
    a.summary = await summarizeInChinese(a.title, text);
    a.image = `https://picsum.photos/seed/${encodeURIComponent(a.id)}/800/420`;
    a.processed = true;
  }

  // 3) 发布
  const ready = data.articles.filter((a) => a.processed).slice(0, 8);
  let published: string | null = null;
  if (ready.length > 0) {
    const title = `每日精选 · ${date}`;
    const body = [
      `# ${title}`, "",
      `今天为你精选 ${ready.length} 篇文章：`, "",
      ...ready.map((a, i) => `## ${i + 1}. ${a.title}\n\n${a.summary ?? ""}\n\n原文链接：${a.url}\n`),
    ].join("\n");
    data.publications.unshift({
      id: uid("p"), date, platform: "微信", title, body,
      articleIds: ready.map((a) => a.id), publishedAt: new Date().toISOString(),
    });
    published = title;
  }

  return NextResponse.json({ ok: true, date, collected, processed: pending.length, published });
}
