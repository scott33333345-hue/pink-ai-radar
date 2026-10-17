# 资讯数据字段

唯一内容源：`data/news.json`。

| 字段 | 类型 | 用途 |
| --- | --- | --- |
| `id` | 正整数 | 稳定标识和详情深链 |
| `source` / `icon` | 字符串 | 发布主体及列表识别 |
| `date` / `display` / `verified` | 字符串 | 排序、发布时间和核验时间 |
| `status` | 字符串 | 正式发布、公测、政策更新等状态 |
| `title` / `summary` | 字符串 | 列表标题和一句话摘要 |
| `fact` / `background` | 字符串 | 可核验事实和必要语境 |
| `why` | 字符串 | 面向产品工作的影响判断 |
| `impact` / `actions` | 字符串数组 | 影响对象和建议行动 |
| `url` / `sourceTitle` | 字符串 | 精确原文地址和原文标题 |
| `sourceType` / `sourceReason` | 字符串 | 信源等级依据 |
| `tags` / `group` | 字符串数组 | 搜索和筛选 |
| `grade` | `A/B/C` | 信源等级 |
| `accent` / `image` | 字符串 | 视觉属性；`image` 可选 |

`data/news.js` 是生成文件，不应手工编辑。

构建时还会自动生成：

- `generatedOn`：页面数据文件的生成日期；
- `coverageThrough`：当前资讯中最新的发布日期。

页面必须同时展示这两个日期，不能把内容覆盖日期称为网站更新时间。

