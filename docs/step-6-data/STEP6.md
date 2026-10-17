# 第 6 步：数据解耦与更新流程

## 结果

- `data/news.json` 成为唯一内容源。
- `data/news.js` 由构建脚本生成，兼容 GitHub Pages 和本地文件预览。
- `app.js` 只负责呈现、筛选、搜索和详情交互。
- 页面中的条目数量、来源可追溯率、页面生成日期和资讯覆盖日期由数据自动计算。
- 无依赖校验脚本覆盖字段、类型、日期、等级、颜色、HTTPS、重复项和粗粒度精确链接检查。
- 建立九步更新流程、发布前清单和字段字典。

## 重要边界

本阶段实现的是“手动采集后的结构化维护、校验与生成”，不是实时采集系统。页面因此明确标注“演示数据截至日期”，不会把页面构建日期冒充为资讯更新时间。

## 验收标准

1. 编辑资讯不需要修改 `app.js`。
2. 无效数据无法生成浏览器数据文件。
3. JSON 与生成文件不一致时，`--check` 返回失败。
4. 现有列表、搜索、筛选、详情和信源功能保持正常。

## 验收命令

```powershell
node scripts\build-data.mjs
node scripts\build-data.mjs --check
node --check app.js
```

## 验收证据

- 数据驱动首页：`data-driven-home.png`
- 数据驱动详情：`data-driven-detail.png`
- 更新操作手册：`UPDATE_WORKFLOW.md`
- 字段字典：`SCHEMA.md`
