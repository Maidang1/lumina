# Lumina 项目总览

最后更新：2026-04-06

## 1. 这个仓库解决什么问题

Lumina 是一个摄影作品库 monorepo，核心能力是：

- 本地解析照片（EXIF、缩略图、感知哈希等）。
- 按统一对象布局写入 Git 仓库。
- 将该仓库作为“对象存储”，由 Web API 只读提供给前端展示。
- 同时支持 Web 浏览端、Desktop 管理端、CLI 批处理端。

## 2. 核心数据流（从照片到展示）

1. 入口：Desktop 或 CLI 接收原始图片。
2. 解析：`lumina-image`（Rust）产出标准化原图、缩略图变体和 metadata。
3. 写入：文件落到 `objects/{p1}/{p2}/sha256_{hash}/...`。
4. 索引：维护 `objects/_index/images.json`。
5. 同步：通过 git push 推送到 GitHub 仓库。
6. 读取：Cloudflare Pages Functions 读取 GitHub 内容并提供 `/api/v1/images*`。
7. 展示：Web 前端请求 API，渲染画廊/地图/详情。

## 3. 目录分工

- `apps/web`：公开浏览站点 + Cloudflare Functions 只读 API。
- `apps/desktop`：桌面管理端（React + Tauri）。
- `packages/contracts`：共享类型、路径和 cursor 编解码。
- `packages/github-storage`：GitHub 内容 API 封装（读写、重试、批量提交逻辑）。
- `packages/gallery-core`：图片映射/预取等前端通用能力。
- `packages/cli`：`lumina-upload` 命令行工具。
- `crates/lumina-image`：底层图像处理 Rust 库。
- `packages/theme`：设计 token 与视觉效果样式。

## 4. 构建与开发（仓库级）

常用命令：

- `pnpm install`
- `pnpm run dev:web`
- `pnpm run dev:full`
- `pnpm run build`
- `pnpm run typecheck`

编排：

- `pnpm-workspace.yaml` 管理 `apps/*` 与 `packages/*`。
- `turbo.json` 管理 `build/typecheck/dev` 任务依赖与缓存。

## 5. 当前关键约束

- API 目前是只读能力（读取 GitHub 对象仓库）。
- 自动化测试框架尚未完整落地（新增测试建议优先 Vitest）。
- Desktop 端仓库连接已改为 GitHub URL 驱动：
  - 用户输入仓库 URL。
  - 应用自动克隆到 App 缓存目录。
  - 同仓库重复连接会复用并执行 pull 同步。
