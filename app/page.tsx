"use client";

import { useCallback, useEffect, useState } from "react";

type Source = { id: string; name: string; url: string; language: string };
type Rules = { language: string; retention: number; topic: string; startHour: number };
type Article = {
  id: string; title: string; url: string; category: string;
  collectedAt: string; summary?: string; image?: string; processed: boolean;
};
type Publication = { id: string; date: string; platform: string; title: string; body: string };
type State = {
  sources: Source[]; categories: string[]; rules: Rules;
  articles: Article[]; publications: Publication[];
  llm: { configured: boolean; baseUrl: string; model: string };
};

export default function Page() {
  const [s, setS] = useState<State | null>(null);
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // config form local state
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourceName, setNewSourceName] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state");
    setS(await res.json());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const call = useCallback(
    async (label: string, url: string, body?: unknown) => {
      setBusy(label);
      setLog(`正在运行：${label} …`);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "失败");
        setLog(summarize(label, data));
        await refresh();
      } catch (e) {
        setLog(`✗ ${label} 出错：${(e as Error).message}`);
      } finally {
        setBusy(null);
      }
    },
    [refresh]
  );

  if (!s) return <div className="wrap"><p className="muted">加载中…</p></div>;

  const processed = s.articles.filter((a) => a.processed);
  const pending = s.articles.filter((a) => !a.processed);

  return (
    <div className="wrap">
      <header className="top">
        <h1>Remover</h1>
        <span className="tag">内容聚合 · 翻译 · 总结 · 发布流水线</span>
      </header>
      <p className="muted" style={{ marginTop: 4 }}>
        <span className="llm-badge">
          <span className={`dot ${s.llm.configured ? "on" : "off"}`} />
          {s.llm.configured
            ? `LLM 已连接 · ${s.llm.model}`
            : "LLM 未配置 (设置 LLM_API_KEY 启用真实翻译/总结，当前使用模拟输出)"}
        </span>
      </p>

      {/* Workers */}
      <section className="block">
        <h2>三个工人 (Workers)</h2>
        <div className="grid cols-3">
          <div className="card">
            <div className="worker-step">STEP 1</div>
            <h2>收集帖子的工人</h2>
            <p className="desc">按主题抓取热门文章地址，用 LLM 分类，保存到当天文件夹 (articles.txt)。</p>
            <button className="primary" disabled={!!busy} onClick={() => call("收集", "/api/collect")}>
              {busy === "收集" ? "运行中…" : "运行收集"}
            </button>
          </div>
          <div className="card">
            <div className="worker-step">STEP 2</div>
            <h2>处理帖子的工人</h2>
            <p className="desc">抓取正文，用中文总结、整篇翻译，生成 &lt;date&gt;-&lt;title&gt; 子目录与封面图。</p>
            <div className="row tight">
              <button className="primary" disabled={!!busy || pending.length === 0}
                onClick={() => call("处理", "/api/process", { limit: 3, translate: false })}>
                {busy === "处理" ? "运行中…" : `处理 ${pending.length} 篇`}
              </button>
              <button disabled={!!busy || pending.length === 0}
                onClick={() => call("处理+翻译", "/api/process", { limit: 3, translate: true })}>
                +翻译
              </button>
            </div>
          </div>
          <div className="card">
            <div className="worker-step">STEP 3</div>
            <h2>发布文章的工人</h2>
            <p className="desc">整理当天已处理文章，生成汇总(摘要+原文链接)，发布到不同平台。</p>
            <div className="row tight">
              <button className="primary" disabled={!!busy || processed.length === 0}
                onClick={() => call("发布", "/api/publish", { platform: "微信" })}>
                发布到微信
              </button>
              <button disabled={!!busy || processed.length === 0}
                onClick={() => call("发布", "/api/publish", { platform: "小红书" })}>
                小红书
              </button>
            </div>
          </div>
        </div>
        <p className="log">{log}</p>
      </section>

      {/* Config */}
      <section className="block">
        <h2>规则与源 (Config)</h2>
        <div className="grid cols-2">
          <div className="card">
            <h2>采集规则</h2>
            <label>主题 (取什么样的文章)</label>
            <input value={s.rules.topic}
              onChange={(e) => setS({ ...s, rules: { ...s.rules, topic: e.target.value } })}
              onBlur={() => call("更新规则", "/api/config", { rules: s.rules })} />
            <div className="grid cols-2" style={{ marginTop: 0 }}>
              <div>
                <label>语言</label>
                <select value={s.rules.language}
                  onChange={(e) => { const r = { ...s.rules, language: e.target.value }; setS({ ...s, rules: r }); call("更新规则", "/api/config", { rules: r }); }}>
                  <option value="en">英文</option>
                  <option value="zh">中文</option>
                  <option value="ja">日文</option>
                </select>
              </div>
              <div>
                <label>每天开始时间 (点)</label>
                <input type="number" min={0} max={23} value={s.rules.startHour}
                  onChange={(e) => setS({ ...s, rules: { ...s.rules, startHour: Number(e.target.value) } })}
                  onBlur={() => call("更新规则", "/api/config", { rules: s.rules })} />
              </div>
            </div>
            <label>每个分类保留文章数</label>
            <input type="number" min={1} value={s.rules.retention}
              onChange={(e) => setS({ ...s, rules: { ...s.rules, retention: Number(e.target.value) } })}
              onBlur={() => call("更新规则", "/api/config", { rules: s.rules })} />
          </div>

          <div className="card">
            <h2>分类 ({s.categories.length})</h2>
            <div>
              {s.categories.map((c) => (
                <span className="chip" key={c}>{c}
                  <button title="删除" onClick={() => call("删除分类", "/api/config", { removeCategory: c })}>×</button>
                </span>
              ))}
              {s.categories.length === 0 && <span className="empty">暂无分类</span>}
            </div>
            <div className="row tight" style={{ marginTop: 12 }}>
              <input placeholder="新分类名称" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
              <button onClick={() => { if (newCategory.trim()) { call("添加分类", "/api/config", { addCategory: newCategory.trim() }); setNewCategory(""); } }}>添加</button>
            </div>

            <h2 style={{ marginTop: 18 }}>内容源 ({s.sources.length})</h2>
            <div>
              {s.sources.map((src) => (
                <span className="chip" key={src.id}>{src.name}
                  <button title="删除" onClick={() => call("删除源", "/api/config", { removeSourceId: src.id })}>×</button>
                </span>
              ))}
            </div>
            <div className="row tight" style={{ marginTop: 12 }}>
              <input placeholder="名称" value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)} />
              <input placeholder="https://…" value={newSourceUrl} onChange={(e) => setNewSourceUrl(e.target.value)} />
              <button onClick={() => { if (newSourceUrl.trim()) { call("添加源", "/api/config", { addSource: { name: newSourceName, url: newSourceUrl } }); setNewSourceName(""); setNewSourceUrl(""); } }}>添加</button>
            </div>
          </div>
        </div>
      </section>

      {/* Articles */}
      <section className="block">
        <div className="row tight" style={{ alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>文章库 ({s.articles.length})</h2>
          <button
            disabled={!!busy || s.articles.length === 0}
            onClick={() => {
              if (confirm("确定清空文章库和发布记录吗？")) call("清空", "/api/reset");
            }}
          >
            清空文章库
          </button>
        </div>
        {s.articles.length === 0 && <p className="empty">还没有文章，点击「运行收集」开始。</p>}
        {s.articles.map((a) => (
          <div className="article" key={a.id}>
            <div className="meta">
              <span className="badge cat">{a.category}</span>
              <span className={`badge ${a.processed ? "done" : "todo"}`}>{a.processed ? "已处理" : "待处理"}</span>
              <span>{a.collectedAt}</span>
              <a href={a.url} target="_blank" rel="noreferrer">原文 ↗</a>
            </div>
            <h3>{a.title}</h3>
            {a.summary && <div className="summary">{a.summary}</div>}
            {a.processed && (
              <div className="path">{a.collectedAt}-{slugOf(a.title)}/ → .txt · .png</div>
            )}
          </div>
        ))}
      </section>

      {/* Publications */}
      <section className="block">
        <h2>已发布 ({s.publications.length})</h2>
        {s.publications.length === 0 && <p className="empty">还没有发布记录。</p>}
        {s.publications.map((p) => (
          <div className="card" key={p.id} style={{ marginBottom: 12 }}>
            <div className="meta" style={{ marginBottom: 8 }}>
              <span className="badge cat">{p.platform}</span>
              <span className="muted">{p.date}</span>
            </div>
            <pre className="pub">{p.body}</pre>
          </div>
        ))}
      </section>

      <footer style={{ marginTop: 40 }}>
        <p className="muted" style={{ fontSize: 13 }}>
          数据存储为内存态 (适合演示)。生产环境请接入 KV / 数据库。LLM 通过环境变量配置：
          <code> LLM_API_KEY</code>、<code> LLM_BASE_URL</code>、<code> LLM_MODEL</code>。
        </p>
      </footer>
    </div>
  );
}

function slugOf(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9一-龥]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function summarize(label: string, data: any): string {
  if (label === "收集") return `✓ 收集完成：新增 ${data.addedCount} 篇 (${data.date})`;
  if (label.startsWith("处理")) return `✓ 处理完成：${data.processedCount} 篇已生成摘要`;
  if (label === "发布") return `✓ 已发布到 ${data.publication.platform}：${data.publication.title}`;
  if (label === "清空") return "✓ 已清空文章库与发布记录";
  return "✓ 完成";
}
