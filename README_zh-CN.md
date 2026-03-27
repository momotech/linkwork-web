# linkwork-web

`linkwork-web` 是 LinkWork 的前端管理台，基于 Vue 3 + Vite + TypeScript，负责任务管理、岗位配置、审批、MCP/Skills 管理等页面。

## 本地开发

### 1) 环境要求

- Node.js 22+
- npm 10+

### 2) 安装依赖

```bash
cd linkwork-web
npm install
```

### 3) 启动开发服务

```bash
npm run dev
```

默认通过 Vite 代理 `/api` 到 `http://localhost:8081`（可通过 `VITE_DEV_API_PROXY_TARGET` 覆盖）。

### 4) 生产构建与预览

```bash
npm run build
npm run preview
```

## 关键环境变量

| 变量 | 说明 |
|---|---|
| `VITE_DEV_API_PROXY_TARGET` | 本地开发 API 代理地址 |
| `VITE_SSO_LOGIN_URL` | 未登录时跳转地址（默认 `/login`） |
| `VITE_BYPASS_AUTH_GUARD` | 是否绕过前端路由鉴权（默认开启，设置为 `false` 可关闭） |
| `VITE_WATERMARK_PRODUCT` | 页面水印产品名 |
| `VITE_WATERMARK_OWNER` | 页面水印归属 |
| `VITE_MODEL_ALL_ACCESS_WHITELIST` | 模型全量可见用户白名单（CSV） |
| `VITE_MODEL_DEFAULT_ALLOW_LIST` | 默认可见模型列表（CSV） |

## Deploy 流程

### 方案 A：使用仓库根目录脚本部署到远端主机（推荐）

在 `link-work` 根目录执行：

```bash
GG_HOST=<remote_host> \
REMOTE_USER=<remote_user> \
BRANCH=<target_branch> \
PORT=3000 \
BACKEND_UPSTREAM=http://<backend_host>:8081 \
./deploy-linkwork-web-gg.local.sh
```

脚本行为：

1. SSH 到远端并校验/克隆 `linkwork-web` 仓库
2. 切换到指定分支并 `npm install && npm run build`
3. 生成 Nginx 配置（`/api/` 反向代理到后端）
4. 使用 `nginx:1.27-alpine` 启动容器
5. 执行 `/` 与 `/home` 健康检查（含 SPA fallback）

### 方案 B：手动容器发布

```bash
# 在 linkwork-web 内
npm install
npm run build

# 用 dist + nginx 配置启动容器
docker run -d --name linkwork-web -p 3000:80 \
  -v $(pwd)/dist:/usr/share/nginx/html:ro \
  -v $(pwd)/nginx.default.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:1.27-alpine
```

## 联动依赖

- 后端默认对接 `linkwork-server` API（通常由 `LinkWork/backend` 提供）
- 运行时依赖浏览器与后端 Cookie/JWT 认证链路
