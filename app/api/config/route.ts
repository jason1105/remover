import { NextResponse } from "next/server";
import { db, uid } from "@/lib/store";

export const dynamic = "force-dynamic";

// Update rules, add/remove sources & categories.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const data = db();

  if (body.rules) {
    data.rules = {
      ...data.rules,
      ...body.rules,
      retention: Math.max(1, Number(body.rules.retention ?? data.rules.retention)),
      startHour: Math.min(23, Math.max(0, Number(body.rules.startHour ?? data.rules.startHour))),
    };
  }

  if (body.addSource?.url) {
    data.sources.push({
      id: uid("s"),
      name: body.addSource.name || body.addSource.url,
      url: body.addSource.url,
      language: body.addSource.language || "en",
    });
  }

  if (body.removeSourceId) {
    data.sources = data.sources.filter((s) => s.id !== body.removeSourceId);
  }

  if (body.addCategory && !data.categories.includes(body.addCategory)) {
    data.categories.push(body.addCategory);
  }

  if (body.removeCategory) {
    data.categories = data.categories.filter((c) => c !== body.removeCategory);
  }

  return NextResponse.json({ ok: true, ...data });
}
