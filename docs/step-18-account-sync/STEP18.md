# 第 18 步：账号登录与云端收藏

## 产品目标

用户使用邮箱账号登录后，收藏保存到账号而非某一台设备；之后在其他浏览器或设备登录同一账号，也能看到相同收藏。

## 已实现

- 页头新增登录入口和账号状态；
- 支持邮箱密码注册、登录与退出；
- Supabase 自动保存登录会话；
- 登录后从 `favorites` 表读取当前账号的收藏；
- 首次登录自动将当前浏览器的本机收藏合并到账号；
- 登录状态下的收藏和取消收藏即时写入云端；
- 退出账号后切回访客本机收藏，避免在共享设备泄露账号数据；
- 未配置云服务或同步失败时显示真实错误，不伪装成已保存。

## 启用步骤

1. 在 Supabase 创建项目。
2. 打开 SQL Editor，执行 [`supabase/favorites.sql`](../../supabase/favorites.sql)。
3. 在 Authentication 的 URL Configuration 中设置：
   - Site URL：`https://scott33333345-hue.github.io/pink-ai-radar/`
   - Redirect URL：`https://scott33333345-hue.github.io/pink-ai-radar/`
4. 从项目设置复制 Project URL 和 Publishable key，填写到根目录 `supabase-config.js`。
5. 不要把 `service_role` key、数据库密码或其他管理员密钥写入前端。
6. 提交并部署后执行跨浏览器验收。

## 数据与安全边界

- 前端只使用 Publishable key；它不是管理员密钥。
- `favorites` 表启用 RLS，并针对查询、新增、更新、删除分别限制为 `auth.uid() = user_id`。
- 匿名访问者没有数据库权限。
- 密码由 Supabase Auth 处理，Pink AI Radar 不保存明文密码。
- 当前只同步收藏；反馈和使用分析仍保存在本机。

## 上线验收

1. 注册 A 账号，完成邮箱验证并登录。
2. 收藏资讯 1，刷新后仍显示已收藏。
3. 在另一个浏览器登录 A 账号，资讯 1 出现在“我的收藏”。
4. 退出 A，登录 B 账号，不能看到 A 的收藏。
5. B 收藏资讯 2，不影响 A 的收藏。
6. 删除或取消收藏后，另一个浏览器刷新可看到同步结果。

## 当前状态

前端、数据库脚本和异常降级已完成。真实注册与跨设备同步需要填入当前 Supabase 项目的 Project URL 和 Publishable key 后才能联调。
