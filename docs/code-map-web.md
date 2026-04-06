# Web 端代码地图（apps/web + functions）

最后更新：2026-04-06

## 1. 入口与路由

- 前端入口：`apps/web/src/app/main.tsx`
  - 挂载 React，开发环境注入 `click-to-react-component`。
- 应用路由：`apps/web/src/app/App.tsx`
  - 页面路由：`/`（Landing）、`/gallery`、`/map`。
  - 通过 `usePhotosCollection` 统一驱动 gallery/map 数据。

## 2. 前端功能分层

- `features/landing`：首页内容（Hero、统计、集合预览）。
- `features/gallery`：相册视图层（列表、网格、过滤、工具栏）。
- `features/photos`：数据模型和服务层（API 调用、photo 映射、地图相关）。
- `shared/ui` 与 `shared/components`：通用 UI 与状态组件。

推荐先读：

1. `apps/web/src/app/App.tsx`
2. `apps/web/src/features/photos/hooks/usePhotosCollection.ts`
3. `apps/web/src/features/gallery/GalleryPage.tsx`

## 3. Functions API 结构

API 目录：`apps/web/functions/api/v1/images`

- `index.ts`：`GET /api/v1/images`
  - 读取 `objects/_index/images.json`。
  - 处理 cursor + limit 分页。
  - 支持 ETag / 304。
- `[id].ts`：`GET /api/v1/images/:id`
  - 读取单张 `meta.json`。
- `[id]/[type].ts`：`GET /api/v1/images/:id/thumb|original`
  - 解析 metadata 中声明路径，302 跳转到 jsDelivr。
  - `thumb` 支持 `size=400|800|1600`。

公共函数：

- `apps/web/functions/_utils.ts`：聚合 contracts/github-storage/http helpers。
- `apps/web/functions/utils/http.ts`：CORS、错误映射、ETag 工具。

## 4. 常改点定位

- 改 API 返回字段：先改 `packages/contracts/src/types.ts`，再改对应 functions 实现。
- 改图片 URL 构造：看 `apps/web/functions/utils/http.ts` 的 `buildJsDelivrUrl`。
- 改分页行为：看 `apps/web/functions/api/v1/images/index.ts` 的 cursor 逻辑。
- 改前端数据映射：看 `apps/web/src/features/photos/services/photoMapper.ts`。

## 5. 运行与配置

- 入口构建配置：`apps/web/rsbuild.config.ts`。
- 本地函数环境：`apps/web/.dev.vars`（`GITHUB_TOKEN`, `ALLOW_ORIGIN`）。
- 部署变量：`apps/web/wrangler.toml`（`GH_OWNER`, `GH_REPO`, `GH_BRANCH`）。
