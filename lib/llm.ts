/**
 * LLM access layer.
 *
 * All credentials/config are read from environment variables so nothing is
 * hard-coded. Configure these in Vercel (Project Settings → Environment
 * Variables) or in a local `.env.local`:
 *
 *   LLM_API_KEY    – API key for the provider (required to use a real model)
 *   LLM_BASE_URL   – OpenAI-compatible base URL
 *                    (default: https://api.openai.com/v1)
 *   LLM_MODEL      – model name (default: gpt-4o-mini)
 *
 * If LLM_API_KEY is not set, the app falls back to a deterministic mock so the
 * full pipeline still runs end-to-end without any credentials.
 */

const API_KEY = process.env.LLM_API_KEY;
// 去掉结尾多余的斜杠，避免拼出 `//chat/completions` 导致 404。
const BASE_URL = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

export function llmConfigured(): boolean {
  return Boolean(API_KEY);
}

export function llmStatus() {
  return {
    configured: llmConfigured(),
    baseUrl: BASE_URL,
    model: MODEL,
  };
}

async function chat(system: string, user: string): Promise<string> {
  if (!API_KEY) {
    // Mock fallback so the pipeline is fully demoable without credentials.
    return mock(system, user);
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Translate arbitrary text into Chinese (整篇翻译). */
export async function translateToChinese(text: string): Promise<string> {
  return chat(
    "你是一名专业的翻译。把用户提供的文章完整翻译成自然流畅的简体中文，保留段落结构。只输出译文。",
    text
  );
}

/** Summarize an article in Chinese (用中文总结文章内容). */
export async function summarizeInChinese(title: string, text: string): Promise<string> {
  return chat(
    "你是一名内容编辑。用简体中文为文章写一段 3-5 句话的精炼摘要，突出核心观点，不要寒暄。只输出摘要。",
    `标题：${title}\n\n正文：\n${text}`
  );
}

/** Classify an article into one of the provided categories. */
export async function classify(
  title: string,
  text: string,
  categories: string[]
): Promise<string> {
  if (categories.length === 0) return "未分类";
  const answer = await chat(
    `你是一名内容分类器。请把文章归入这些分类之一：${categories.join("、")}。只输出分类名称本身，不要任何解释。`,
    `标题：${title}\n\n正文片段：\n${text.slice(0, 800)}`
  );
  // Snap the model's answer back to a known category.
  const match = categories.find((c) => answer.includes(c));
  return match ?? categories[0];
}

// ---------------------------------------------------------------------------
// Deterministic mock used when no API key is configured.
// ---------------------------------------------------------------------------
function mock(system: string, user: string): string {
  if (system.includes("翻译")) {
    return `【模拟翻译｜未配置 LLM_API_KEY】\n${user.slice(0, 400)}`;
  }
  if (system.includes("分类器")) {
    const m = system.match(/这些分类之一：([^。]+)/);
    const cats = m ? m[1].split("、") : [];
    return cats[0] ?? "未分类";
  }
  // summary
  const firstLine = user.split("\n").find((l) => l.trim()) ?? "";
  return `【模拟摘要｜未配置 LLM_API_KEY】这是一篇关于「${firstLine
    .replace("标题：", "")
    .slice(0, 40)}」的文章，主要介绍了相关主题的背景、要点与影响。配置 LLM_API_KEY 后即可生成真实摘要。`;
}
