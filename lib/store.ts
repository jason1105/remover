/**
 * In-memory data store for the content pipeline.
 *
 * This mirrors the file layout described in the README:
 *   <date>/articles.txt                       (collected URLs)
 *   <date>/<date>-<title>/<date>-<title>.txt  (summary text)
 *   <date>/<date>-<title>/<date>-<title>.png  (cover image, here a URL ref)
 *
 * On a serverless platform like Vercel the filesystem is ephemeral and not
 * shared between invocations, so we keep the structure in memory. Swap this
 * module for a KV/Postgres-backed implementation for real persistence.
 */

export type Source = {
  id: string;
  name: string;
  url: string;
  language: string; // e.g. "en", "zh"
};

export type Rules = {
  language: string; // which language of articles to collect
  retention: number; // 分类下保留的文章数量, 默认 100
  topic: string; // 主题 / 取什么样的文章
  startHour: number; // 每天几点开始干活
};

export type Article = {
  id: string;
  title: string;
  url: string;
  source: string;
  category: string;
  collectedAt: string; // date folder, e.g. 2024-09-29
  // filled by the processor worker
  summary?: string;
  translation?: string;
  image?: string;
  processed: boolean;
};

export type Publication = {
  id: string;
  date: string;
  platform: string;
  title: string;
  body: string;
  articleIds: string[];
  publishedAt: string;
};

type DB = {
  sources: Source[];
  categories: string[];
  rules: Rules;
  articles: Article[];
  publications: Publication[];
};

// Persist across hot reloads in dev.
const g = globalThis as unknown as { __removerDB?: DB };

function seed(): DB {
  return {
    sources: [
      { id: "s1", name: "Hacker News", url: "https://news.ycombinator.com", language: "en" },
      { id: "s2", name: "Lobsters", url: "https://lobste.rs", language: "en" },
    ],
    categories: ["人工智能", "软件工程", "创业商业"],
    rules: { language: "en", retention: 100, topic: "AI", startHour: 8 },
    articles: [],
    publications: [],
  };
}

export function db(): DB {
  if (!g.__removerDB) g.__removerDB = seed();
  return g.__removerDB;
}

export function uid(prefix = "a"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Enforce the per-category retention limit (README: 保留100篇 可配置). */
export function enforceRetention() {
  const { articles, rules } = db();
  const byCategory = new Map<string, Article[]>();
  for (const a of articles) {
    const list = byCategory.get(a.category) ?? [];
    list.push(a);
    byCategory.set(a.category, list);
  }
  const keep = new Set<string>();
  for (const list of byCategory.values()) {
    list
      .sort((x, y) => (x.collectedAt < y.collectedAt ? 1 : -1))
      .slice(0, rules.retention)
      .forEach((a) => keep.add(a.id));
  }
  g.__removerDB!.articles = articles.filter((a) => keep.has(a.id));
}

export function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
