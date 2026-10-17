# AI 简报更新流程

## 一次更新的标准流程

1. **收集线索**：记录候选标题、官方页面和发现时间；社交帖子只能作为线索。
2. **去重筛选**：检查原文 URL、事件主体和核心事实，合并同一事件的重复线索。
3. **建立草稿**：复制 `data/news.json` 中一条完整记录，分配未使用的整数 ID。
4. **提炼事实**：先填写 `fact` 和 `background`，再填写 `why`、`impact` 和 `actions`。
5. **人工核验**：打开原文核对主体、日期、发布状态、限制条件和关键数字。
6. **标注信源**：填写精确 `url`、`sourceTitle`、`sourceType`、`sourceReason` 和 `verified`。
7. **自动校验**：运行 `node scripts/build-data.mjs`，失败时不发布。
8. **页面验收**：检查首页、组合筛选、详情页和官方原文链接。
9. **发布留档**：提交 `news.json` 与自动生成的 `news.js`，记录本次更新日期。

## 发布前清单

- [ ] 原文来自发布主体或满足 B 级双源互证
- [ ] URL 指向具体文章，不是首页或新闻列表
- [ ] 标题没有把预览、公测或计划写成正式发布
- [ ] 事实摘要没有混入产品判断
- [ ] “为什么重要”说明了对产品工作的影响
- [ ] 行动建议具体且不夸大确定性
- [ ] 发布时间和核验时间已经区分
- [ ] `node scripts/build-data.mjs --check` 通过
- [ ] 页面筛选与详情显示正常

## 命令

```powershell
node scripts\build-data.mjs
node scripts\build-data.mjs --check
node --check app.js
```

如本机安装了 npm，也可以使用：

```powershell
npm run data:build
npm run check
```

## 当前边界

当前版本解决“数据维护与页面代码耦合”以及“发布前质量门槛”，但资讯收集、事实判断和最终核验仍由人工完成；它还不是自动抓取或自动发布系统。

