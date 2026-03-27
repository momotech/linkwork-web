# linkwork-web

English | [中文](./README_zh-CN.md)

`linkwork-web` is the LinkWork management frontend, built with Vue 3 + Vite + TypeScript. It covers task operations, role configuration, approvals, and MCP/Skills related pages.

## Local Development

### 1) Requirements

- Node.js 22+
- npm 10+

### 2) Install dependencies

```bash
cd linkwork-web
npm install
```

### 3) Run dev server

```bash
npm run dev
```

By default, Vite proxies `/api` to `http://localhost:8081`. You can override it with `VITE_DEV_API_PROXY_TARGET`.

### 4) Production build and preview

```bash
npm run build
npm run preview
```

## Key Environment Variables

| Variable | Description |
|---|---|
| `VITE_DEV_API_PROXY_TARGET` | API proxy target in local development |
| `VITE_SSO_LOGIN_URL` | Redirect URL when unauthenticated (default: `/login`) |
| `VITE_BYPASS_AUTH_GUARD` | Bypass frontend auth guard (`false` to disable bypass) |
| `VITE_WATERMARK_PRODUCT` | UI watermark product name |
| `VITE_WATERMARK_OWNER` | UI watermark owner |
| `VITE_MODEL_ALL_ACCESS_WHITELIST` | CSV whitelist for full model access |
| `VITE_MODEL_DEFAULT_ALLOW_LIST` | CSV default model allow-list |

## Deploy Flow

### Option A: Remote deploy via workspace script (recommended)

Run from workspace root (`link-work`):

```bash
GG_HOST=<remote_host> \
REMOTE_USER=<remote_user> \
BRANCH=<target_branch> \
PORT=3000 \
```

The script performs:

1. SSH to remote and validate/clone `linkwork-web`
2. Checkout target branch and run `npm install && npm run build`
3. Generate Nginx config with `/api/` proxy to backend
4. Run `nginx:1.27-alpine` container
5. Check `/` and `/home` (SPA fallback)

### Option B: Manual container deployment

```bash
cd linkwork-web
npm install
npm run build

docker run -d --name linkwork-web -p 3000:80 \
  -v $(pwd)/dist:/usr/share/nginx/html:ro \
  -v $(pwd)/nginx.default.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:1.27-alpine
```

## Dependencies

- Backend APIs are usually provided by `LinkWork/backend`
- Runtime auth path depends on browser cookie/JWT flow
