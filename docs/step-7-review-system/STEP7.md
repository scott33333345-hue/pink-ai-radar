# 第 7 步：自动采集与人工审核发布系统

## 产品边界

系统不是“自动生成并实时发布新闻”。它每 6 小时从已配置的官方订阅源发现候选；任何候选都必须经人工阅读原文、重写摘要、填写产品判断并批准后，才会进入 `data/news.json` 和网站。

## 工作流

1. GitHub Actions 每 6 小时运行 `scripts/collect-news.mjs`。
2. 采集器输出 `data/candidates.json`，并将它保存为 14 天可下载的 Actions artifact。
3. 编辑下载候选文件，运行 `npm run review:list` 查看待审核项。
4. 复制 `data/review.example.json`，填写候选 ID、事实、背景、价值、影响和行动建议。
5. 运行 `node scripts/review-news.mjs approve <审核文件>`。
6. 脚本只允许 A/B 级内容发布，并自动重建 `data/news.js`。
7. 人工检查差异并提交到 `main`，既有 Pages 工作流再发布网站。

## 验收标准

- 采集失败会在日志和 `sources` 报告中显示，不会伪装成功。
- 已发布原文 URL 会自动去重。
- 候选默认状态为 `pending`，不能直接出现在首页。
- C 级、字段不完整或重复 URL 的内容无法通过发布脚本。
- 页面“数据截至”仅取正式发布数据的最新日期，不等同于采集时间。

## 本地命令

```bash
npm run news:collect
npm run review:list
node scripts/review-news.mjs approve path/to/review.json
npm run check
```

## 后续扩展

在 `config/sources.json` 中维护有稳定 RSS/Atom 的官方来源。没有稳定订阅源的网站应单独开发适配器并测试，不能仅凭猜测填写 URL。

首版已验证并启用 OpenAI News 与 Google AI Blog；Microsoft AI 的旧订阅地址返回 HTTP 410，已明确禁用；Anthropic 未发现稳定官方 RSS，因此暂不加入自动源。二者仍可在编辑选题时人工检索和核验。
