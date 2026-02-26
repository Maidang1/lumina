# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Lumina 是一个基于 pnpm + Turbo 的 monorepo 摄影作品集项目，使用 React、TypeScript、Rsbuild 和 Cloudflare Pages Functions 构建。

核心功能：
- 瀑布流画廊，支持 EXIF 信息和地图展示
- 本地图像处理（通过 CLI 或 Desktop 应用）
- Cloudflare Pages Functions API，后端存储使用 GitHub 对象存储
- Token 保护的写入 API

## 工作区结构

```
lumina/
├── apps/
│   ├── web/                    # React 前端 + Cloudflare Pages Functions API
│   │   ├── src/
│   │   │   ├── app/           # 应用入口和路由
│   │   │   ├── features/      # 功能模块（photos 等）
│   │   │   ├── shared/        # 共享组件和工具
│   │   │   └── styles/        # 全局样式
│   │   ├── functions/         # Cloudflare Pages Functions (API 路由)
│   │   │   ├── api/v1/images/ # RESTful API 端点
│   │   │   └── utils/         # Functions 工具函数
│   │   ├── rsbuild.config.ts  # Rsbuild 配置
│   │   └── wrangler.toml      # Cloudflare 配置
│   └── desktop/               # Tauri 桌面应用
├── packages/
│   ├── contracts/             # 共享类型、元数据和路径辅助函数
│   ├── github-storage/        # GitHub 对象/索引存储客户端
│   ├── image-core-native/     # Rust 原生图像处理模块
│   └── cli/                   # lumina-upload 批量上传 CLI
├── crates/
│   └── lumina-image/          # Rust 图像处理库
├── pnpm-workspace.yaml        # pnpm 工作区配置
└── turbo.json                 # Turbo 构建配置
```

## 常用命令

### 开发

```bash
# 安装依赖
pnpm install

# 仅启动前端开发服务器（端口 3000）
pnpm run dev:web

# 完整本地开发模式：前端构建监听 + Pages Functions
pnpm run dev:full

# 仅启动 Cloudflare Pages Functions（需要先构建 dist/）
pnpm run dev:pages
```

### 构建和类型检查

```bash
# 构建所有工作区
pnpm run build

# 类型检查所有工作区
pnpm run typecheck

# 构建 CLI 包
pnpm run cli:build
```

### CLI 工具

```bash
# 开发模式运行 CLI
pnpm run cli:dev

# 上传图片到本地仓库
lumina-upload upload ./photos --repo-path /path/to/local/repo

# 同步到远端
lumina-upload sync --repo-path /path/to/local/repo --message "Add new photos"

# 恢复中断的上传
lumina-upload resume --repo-path /path/to/local/repo

# 验证图片文件
lumina-upload validate ./photos
```

## 本地开发配置

1. 复制环境变量模板：
   ```bash
   cp apps/web/.dev.vars.example apps/web/.dev.vars
   ```

2. 在 `apps/web/.dev.vars` 中填写必需的值：
   - `GITHUB_TOKEN` - GitHub Personal Access Token
   - `ALLOW_ORIGIN` - CORS 允许的源
   - `UPLOAD_TOKEN` - 上传 API 的认证 token

3. 在 `apps/web/wrangler.toml` 中配置：
   - `GH_OWNER` - GitHub 用户名或组织名
   - `GH_REPO` - GitHub 仓库名
   - `GH_BRANCH` - 存储分支名

## API 端点

```
GET    /api/v1/images               # 列出图片（分页）
GET    /api/v1/images/:id           # 获取元数据
PATCH  /api/v1/images/:id           # 更新元数据字段
DELETE /api/v1/images/:id           # 删除图片资源
GET    /api/v1/images/:id/thumb     # 重定向到缩略图
GET    /api/v1/images/:id/original  # 重定向到原图
```

所有修改类 API（PATCH/DELETE）需要在请求头中包含 `x-upload-token`。

## 架构要点

### 图像上传流程

上传通过本地 git 操作完成：
1. CLI 或 Desktop 应用将图片处理后写入本地 git 仓库的 `objects/` 目录
2. 使用 git 命令（add/commit/push）同步到远端 GitHub 仓库

### GitHub 存储

- 图片资源存储在 GitHub 仓库的 `objects/{p1}/{p2}/sha256_{hash}/...` 路径下
- CLI 和 Desktop 直接操作本地 git 仓库
- `github-storage` 包用于 Cloudflare Functions 读取 GitHub 数据

### Cloudflare Pages Functions

- Functions 代码位于 `apps/web/functions/` 目录
- 遵循文件系统路由：`functions/api/v1/images/[id].ts` → `/api/v1/images/:id`
- 使用 `_utils.ts` 中的辅助函数处理认证和 CORS

## 包依赖关系

```
@luminafe/web
  ├─> @luminafe/contracts
  └─> @luminafe/github-storage

@luminafe/cli
  ├─> @luminafe/contracts
  └─> @luminafe/image-core-native

@luminafe/github-storage
  └─> @luminafe/contracts
```

## 代码风格约定

- 对象类型使用 `interface`，联合类型/交叉类型使用 `type`
- 函数必须显式声明返回类型
- 避免使用 `any`、`@ts-ignore` 和非空断言
- React 组件使用函数组件，props 接口命名为 `{ComponentName}Props`
- Tailwind 使用保持与现有暗色主题 token 一致
- 使用 `classnames` 库拼接类名，导入语法：`import cls from 'classnames'`

## 开发注意事项

- 修改脚本、环境变量或 API 路由时，保持 `README.md` 和 `AGENTS.md` 同步
- 避免不必要的大范围重构，保持文档编辑范围与实际行为一致
- 新增依赖使用 `pnpm add <package>` 在对应工作区中添加
- Turbo 会自动处理包之间的构建依赖关系
