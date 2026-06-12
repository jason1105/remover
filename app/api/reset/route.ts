import { NextResponse } from "next/server";
import { db } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * 清空数据。默认只清空文章库与发布记录（保留源/分类/规则配置）。
 * 传 { all: true } 则连配置也一并重置为初始种子。
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const data = db();

  data.articles = [];
  data.publications = [];

  if (body.all) {
    data.sources = [];
    data.categories = [];
  }

  return NextResponse.json({ ok: true, cleared: true });
}
