
- 自动获取最近文章

    - 根据配置的源获取并分类
    - 分类层级管理
    - 分类下的文章保留100篇 可配置
- 自动翻译整篇文章
- 自动发布到几个平台
    - 微信, 
    - 小红书, 


- 收集帖子的工人, 这个工人可以提供一些最近的文章地址, 并对这些文章进行分类.
    - 工人每天定时取得一些文章
    - 可以告诉工人一些规则, 例如: 取得什么样的文章, 取得什么语言的文章, 什么时候开始干活.
    - 拿到这些文章地址后, 保存到文件中
        - 用当天的日期创建一个文件夹
        - 在文件夹中创建一个 articles.txt, 保存文章地址
    - 难点:  如何根据一个主题选择最热门的文章.
- 处理帖子的工人
    - 进入每天的文件夹
    - 读取 articles.txt, 为每个文章创建一个子目录
        - `2024-09-29-<article-title>`
        - 在子目录中添加文本 `2024-09-29-<article-title>.txt` 
        - 在子目录中添加一个图片 `2024-09-29-<article-title>.png`  
    - 用中文总结文章内容.
    - 难点: 如何准确的拿到文章的内容, 以及文章的标题图片.
- 发布文章的工人
    - 从每天的文件夹中整理文档
    - 每天定时发布一篇文章, 文章中只需要列出最新的一些文章, 以及这些文章的总结, 同时附上原文的链接.
    - 这样的工人可以有多个, 将文章分享到不同的平台.



---

## Web App 实现 (Next.js · 可部署到 Vercel)

本仓库在上述需求基础上实现了一个**内容聚合发布流水线**的 Web 仪表盘，覆盖三个工人：

| 工人 | 路由 | 说明 |
| --- | --- | --- |
| 收集帖子 | `POST /api/collect` | 按主题抓取热门文章地址，用 LLM 分类，保存到当天「文件夹」(articles.txt)，按分类保留 N 篇 |
| 处理帖子 | `POST /api/process` | 抓取正文，用中文总结、整篇翻译，生成 `<date>-<title>` 子目录与封面图 |
| 发布文章 | `POST /api/publish` | 整理已处理文章，生成汇总(摘要+原文链接)，发布到不同平台(微信/小红书) |
| 定时全流程 | `GET /api/cron` | Vercel Cron 每天串联执行 收集→处理→发布 |

前端是 `/` 的单页仪表盘，可配置：采集主题、语言、每日开始时间、分类保留数、内容源与分类。

### LLM 变量 (按需配置)
LLM 通过环境变量接入，**未配置时使用模拟输出**，流水线仍可完整演示：

```
LLM_API_KEY    # 提供商 API Key（必填才会调用真实模型）
LLM_BASE_URL   # OpenAI 兼容地址，默认 https://api.openai.com/v1
LLM_MODEL      # 模型名，默认 gpt-4o-mini
CRON_SECRET    # 可选，保护定时任务接口
```
见 `.env.example`。

### 本地运行
```bash
npm install
cp .env.example .env.local   # 按需填入 LLM_API_KEY
npm run dev                  # http://localhost:3000
```

### 部署到 Vercel
1. 在 Vercel 导入本 GitHub 仓库（自动识别 Next.js）。
2. 在 Project Settings → Environment Variables 配置上面的 LLM 变量。
3. Deploy。

> 定时全流程：`/api/cron` 路由已就绪，可被任意定时器触发。Vercel Cron Jobs 需要 Pro 计划，
> 升级后在 `vercel.json` 中加入 `{ "crons": [{ "path": "/api/cron", "schedule": "0 0 * * *" }] }` 即可每日自动执行；
> Hobby 计划可改用外部定时器（如 GitHub Actions / cron-job.org）定时请求该路由。

> 注意：演示用内存存储在 Serverless 下不持久。生产环境请把 `lib/store.ts` 换成 KV / 数据库实现。
