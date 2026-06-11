/**
 * Article fetching utilities used by the collector & processor workers.
 *
 * The README's hard problem — "如何根据一个主题选择最热门的文章" — is handled
 * here by pulling ranked stories from Hacker News (no API key required) and
 * filtering by the configured topic. If outbound network is unavailable we
 * fall back to a small sample set so the pipeline still works offline.
 */

export type FetchedItem = {
  title: string;
  url: string;
  points?: number;
};

const SAMPLE: FetchedItem[] = [
  { title: "How large language models actually reason", url: "https://example.com/llm-reasoning", points: 420 },
  { title: "Building reliable systems with Rust", url: "https://example.com/rust-reliable", points: 311 },
  { title: "A founder's guide to early distribution", url: "https://example.com/distribution", points: 256 },
  { title: "The hidden cost of microservices", url: "https://example.com/microservices", points: 198 },
  { title: "Vector databases explained", url: "https://example.com/vector-db", points: 176 },
];

/** Fetch popular recent stories matching a topic, ranked by popularity. */
export async function fetchPopular(topic: string, limit: number): Promise<FetchedItem[]> {
  try {
    const q = encodeURIComponent(topic || "technology");
    const res = await fetch(
      `https://hn.algolia.com/api/v1/search_by_date?tags=story&query=${q}&hitsPerPage=${limit * 3}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error(`HN ${res.status}`);
    const data = await res.json();
    const items: FetchedItem[] = (data?.hits ?? [])
      .filter((h: any) => h.url && h.title)
      .map((h: any) => ({ title: h.title as string, url: h.url as string, points: h.points ?? 0 }))
      .sort((a: FetchedItem, b: FetchedItem) => (b.points ?? 0) - (a.points ?? 0))
      .slice(0, limit);
    if (items.length > 0) return items;
    throw new Error("no hits");
  } catch {
    return SAMPLE.slice(0, limit);
  }
}

/**
 * Best-effort fetch of article text. Strips tags crudely; for production use a
 * real readability extractor. Falls back to a stub on failure.
 */
export async function fetchArticleText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(String(res.status));
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 4000) || `（无法提取正文）来源：${url}`;
  } catch {
    return `（无法抓取正文，使用占位内容）这是来自 ${url} 的文章，用于演示处理流程。`;
  }
}
