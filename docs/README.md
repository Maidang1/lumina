# Lumina 文档索引

最后更新：2026-04-06

这组文档的目标是：让你下次回来看代码时，先按功能定位到文件，再深入实现细节。

## 建议阅读顺序

1. `project-overview.md`：先建立整体心智模型（系统边界、数据流、目录分工）。
2. `code-map-web.md`：看 Web 前端 + Cloudflare Functions 的入口和职责。
3. `code-map-desktop.md`：看桌面端（React + Tauri）的业务流和命令边界。
4. `code-map-shared.md`：看共享包、CLI、Rust 图像内核。
5. `usage.md`：面向使用者的操作指南（安装/运行/排障）。

## 快速定位（按需求）

| 需求 | 先看这些文件 |
| --- | --- |
| 改 Web 路由或页面框架 | `apps/web/src/app/main.tsx`, `apps/web/src/app/App.tsx` |
| 改 Web 图片列表/详情 API | `apps/web/functions/api/v1/images/index.ts`, `apps/web/functions/api/v1/images/[id].ts` |
| 改 Web 原图/缩略图跳转 | `apps/web/functions/api/v1/images/[id]/[type].ts` |
| 改桌面端仓库连接（GitHub URL -> 自动克隆缓存） | `apps/desktop/src/features/settings/pages/SettingsPage.tsx`, `apps/desktop/src-tauri/src/commands/clone.rs` |
| 改桌面端上传链路 | `apps/desktop/src/features/upload/components/UploadWorkspace.tsx`, `apps/desktop/src/services/uploadService.ts`, `apps/desktop/src-tauri/src/commands/image.rs` |
| 改 Git 提交/同步/变更预览 | `apps/desktop/src/features/git/*`, `apps/desktop/src-tauri/src/commands/github.rs` |
| 改元数据结构/路径规则 | `packages/contracts/src/types.ts`, `packages/contracts/src/image.ts` |
| 改 GitHub 存储读写策略 | `packages/github-storage/src/github.ts` |
| 改 CLI 行为 | `packages/cli/src/index.ts` |
| 改底层图像解析/缩略图/EXIF | `crates/lumina-image/src/lib.rs` 及同目录模块 |

## 约定

- 文档里的路径都按仓库根目录为基准。
- 若功能与现状不一致，优先以代码为准，再更新这里的文档。
