import { NextResponse } from "next/server";
import { db, uid, today, enforceRetention } from "@/lib/store";
import { fetchPopular } from "@/lib/fetcher";
import { classify } from "@/lib/llm";

export const dynamic = "force-dynamic";

/**
 * 收集帖子的工人 (Collector worker)
 * - 取得最近热门文章地址
 * - 用 LLM 对文章进行分类
 * - 保存到当天的「文件夹」(date) 中, 等价于 articles.txt
 */
export async function POST() {
  const data = db();
  const date = today();
  const items = await fetchPopular(data.rules.topic, 8);

  const added = [];
  for (const item of items) {
    if (data.articles.some((a) => a.url === item.url)) continue;
    const category = await classify(item.title, item.title, data.categories);
    const article = {
      id: uid("a"),
      title: item.title,
      url: item.url,
      source: "fetcher",
      category,
      collectedAt: date,
      processed: false,
    };
    data.articles.push(article);
    added.push(article);
  }

  enforceRetention();

  return NextResponse.json({
    ok: true,
    date,
    addedCount: added.length,
    added,
    articlesTxt: data.articles
      .filter((a) => a.collectedAt === date)
      .map((a) => a.url)
      .join("\n"),
  });
}
