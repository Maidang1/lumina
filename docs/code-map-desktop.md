# Desktop 端代码地图（apps/desktop）

最后更新：2026-04-06

## 1. 架构分层

Desktop 由两层组成：

- 前端层（React + Vite）：`apps/desktop/src`
- 原生层（Tauri + Rust）：`apps/desktop/src-tauri/src`

前端通过 `@tauri-apps/api/core invoke` 调用 Rust 命令。

## 2. 前端入口与页面

- 入口：`apps/desktop/src/main.tsx`
- 根组件：`apps/desktop/src/App.tsx`
  - 三个主视图：`upload`、`manage`、`settings`
  - 壳层在 `layouts/AppShell.tsx`

状态管理：

- 全局 UI 状态：`stores/appStore.ts`
- 照片集合状态：`stores/photosStore.ts`
- 设置状态：`features/settings/hooks/useSettingsStore.ts`

## 3. 仓库连接逻辑（重点）

配置页：`features/settings/pages/SettingsPage.tsx`

当前行为：

- 用户只输入 GitHub 仓库 URL。
- 点击“连接仓库”后调用 `cloneGitHubRepo`（Tauri 命令）。
- 成功后通过 `getRepoStatus` 刷新状态。

Rust 端实现：`src-tauri/src/commands/clone.rs`

- 解析 GitHub URL（支持 `https://...` / `git@github.com:...` / `github.com/...`）。
- 默认克隆目录：App 缓存目录下 `repos/{owner}_{repo}_{hash}`。
- 若目录已存在且是 Git 仓库：
  - 校验 `origin` 是否匹配目标仓库。
  - 匹配则执行 `git pull --rebase` 同步。
- 连接成功后自动写入 `lumina.git_repo_path`（store：`lumina.json`）。

相关前端文件：

- `src/lib/tauri/clone.ts`
- `src/hooks/useCloneProgress.ts`
- `src/features/settings/components/CloneProgressDialog.tsx`

## 4. 上传与 Git 操作路径

上传路径（前端）：

1. `UploadWorkspace` 负责文件选择与队列。
2. `useParseScheduler` / `useEventDrivenSubmitScheduler` 驱动处理并发。
3. `uploadService` 统一封装调用。

上传路径（Rust）：

- `commands/image.rs`：解析图片、缓存产物、上传 GitHub。
- `commands/metadata.rs`：metadata 合并校验。
- `commands/events.rs`：批量上传事件流。

Git 操作（变更、commit、push）：

- 前端：`features/git/*` + `lib/tauri/github.ts`
- Rust：`commands/github.rs`

## 5. Tauri 命令注册入口

`src-tauri/src/lib.rs` 的 `invoke_handler` 是总入口，新增命令时必须在这里注册。

建议调试顺序：

1. 前端触发文件（按钮/交互）
2. `src/lib/tauri/*.ts` 封装
3. `src-tauri/src/commands/*.rs` 命令实现
4. `src-tauri/src/github/*` 底层 GitHub 客户端逻辑
