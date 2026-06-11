import { NextResponse } from "next/server";
import { db, uid, today } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * 发布文章的工人 (Publisher worker)
 * - 整理当天已处理的文章
 * - 生成一篇汇总: 列出最新文章 + 中文总结 + 原文链接
 * - 可发布到不同平台 (微信 / 小红书 ...)
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const platform = body.platform || "微信";
  const date = today();
  const data = db();

  const ready = data.articles.filter((a) => a.processed).slice(0, 10);
  if (ready.length === 0) {
    return NextResponse.json({ ok: false, error: "没有已处理的文章可发布" }, { status: 400 });
  }

  const title = `每日精选 · ${date}`;
  const body_ = [
    `# ${title}`,
    "",
    `今天为你精选 ${ready.length} 篇文章：`,
    "",
    ...ready.map(
      (a, i) =>
        `## ${i + 1}. ${a.title}\n\n${a.summary ?? ""}\n\n原文链接：${a.url}\n`
    ),
  ].join("\n");

  const pub = {
    id: uid("p"),
    date,
    platform,
    title,
    body: body_,
    articleIds: ready.map((a) => a.id),
    publishedAt: new Date().toISOString(),
  };
  data.publications.unshift(pub);

  return NextResponse.json({ ok: true, publication: pub });
}
