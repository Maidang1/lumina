# 共享模块代码地图（packages + crates）

最后更新：2026-04-06

## 1. contracts（类型与路径规则）

目录：`packages/contracts/src`

- `types.ts`：全局共享协议，含 `ImageMetadata`、`ImageIndexFile`、`Env`。
- `image.ts`：图片 ID 规则与对象路径规则：
  - `imageIdToObjectPath`
  - `imageIdToMetaPath`
  - cursor 编解码

什么时候先改这里：

- API 字段改动
- metadata 结构变更
- object 路径命名规则变更

## 2. github-storage（GitHub 仓库访问层）

目录：`packages/github-storage/src`

- `github.ts`：核心客户端，封装 GitHub Contents/Git API。
  - 读取文件、写入文件、更新索引
  - 重试与退避策略
  - 批量提交（tree/commit/ref）流程
- `encoding.ts`：base64/utf8 编解码。

Web Functions 和 Desktop Rust 的 GitHub 行为，很多设计都与这里的规则对齐。

## 3. gallery-core（前端图片领域能力）

目录：`packages/gallery-core/src`

- `photoMapper.ts`：把 metadata 映射成前端展示模型。
- `thumbhash.ts`：thumbhash 数据 URL 转换。
- `imagePrefetchService.ts`：图片预取。

适用场景：Web 与 Desktop 需要统一“图片视图数据组织方式”时。

## 4. cli（批处理命令）

入口：`packages/cli/src/index.ts`

核心职责：

- 扫描文件、调用 `@luminafe/image-core-native` 解析。
- 写入 object 文件布局与索引。
- 执行 git add/commit/push。
- 支持 `upload / sync / resume / validate / migrate-layout`。

CLI 仍以显式 `--repo-path`（或 `LUMINA_REPO_PATH`）驱动。

## 5. lumina-image（Rust 图像处理内核）

目录：`crates/lumina-image/src`

- `lib.rs`：主 pipeline（解码、EXIF、方向处理、缩略图、hash、metadata）。
- `decode.rs` / `thumbnail.rs` / `exif.rs` / `hash.rs` / `metadata.rs` 等：分阶段实现。

该 crate 被 Desktop（Tauri）和 Native 模块复用，是解析质量与性能的核心。

## 6. theme（设计 token）

目录：`packages/theme/src`

- `tokens.css`：颜色/阴影/语义 token（含 dark/light）。
- `effects.css`：视觉效果样式。

Web 与 Desktop 的 UI 风格一致性主要依赖这里。
