# 自托管部署指南

本文档面向 fork 本项目的用户，详细说明从零开始完成部署所需的全部配置步骤。

## 目录

- [前置准备](#前置准备)
- [第一步：准备 GitHub 图床仓库](#第一步准备-github-图床仓库)
- [第二步：配置 GitHub OAuth](#第二步配置-github-oauth)
- [第三步：部署 OAuth Worker](#第三步部署-oauth-worker)
- [第四步：获取 AI API Key](#第四步获取-ai-api-key)
- [第五步：部署到 Cloudflare Pages](#第五步部署到-cloudflare-pages)
- [第六步：修改项目配置](#第六步修改项目配置)
- [本地开发配置](#本地开发配置)
- [常见问题](#常见问题)

---

## 前置准备

- GitHub 账号
- Cloudflare 账号（免费版即可）
- Node.js >= 18 + pnpm

---

## 第一步：准备 GitHub 图床仓库

本项目将图片上传到一个 GitHub 仓库作为图床。你需要创建自己的图床仓库。

### 1.1 创建图床仓库

在 GitHub 创建一个新的**公开仓库**（Public），例如命名为 `my-wallpaper-pics`。

目录结构会由本项目自动创建，无需手动初始化。

### 1.2 修改项目中的仓库配置

打开 `src/stores/config.js`，修改 `DEFAULT_CONFIG`：

```js
const DEFAULT_CONFIG = {
  owner: 'your-github-username',   // 改为你的 GitHub 用户名
  repo: 'my-wallpaper-pics',       // 改为你的图床仓库名
  branch: 'main',
  clientId: ''                     // 暂时留空，第二步填写
}
```

### 1.3 分类配置（可选）

如果你想自定义壁纸分类，编辑以下两个文件：

- `src/config/categories.js` — 一级 / 二级分类
- `src/config/subcategories.js` — 三级分类

> 修改分类后，AI 提示词会自动读取新的分类列表，无需手动更新提示词。

---

## 第二步：配置 GitHub OAuth

OAuth 登录用于获取用户的 GitHub Token，从而拥有向图床仓库写入文件的权限。

### 2.1 创建 OAuth App

1. 打开 [GitHub Developer Settings](https://github.com/settings/developers)
2. 点击 **New OAuth App**
3. 填写信息：
   - **Application name**：随意，如 `Wallpaper Studio`
   - **Homepage URL**：你的 Cloudflare Pages 域名，如 `https://your-app.pages.dev`
   - **Authorization callback URL**：`https://your-app.pages.dev/callback`
4. 点击 **Register application**
5. 记录 **Client ID**
6. 点击 **Generate a new client secret**，记录 **Client Secret**

### 2.2 将 Client ID 填入项目

打开 `src/stores/config.js`，将 `clientId` 填入：

```js
const DEFAULT_CONFIG = {
  owner: 'your-github-username',
  repo: 'my-wallpaper-pics',
  branch: 'main',
  clientId: 'Ov23liXXXXXXXXXXXXXX'  // 填入你的 Client ID
}
```

---

## 第三步：部署 OAuth Worker

GitHub OAuth 需要用 Client Secret 换取 Token，这一步必须在服务端完成（不能暴露 Secret 到前端）。本项目使用 Cloudflare Worker 完成这个交换。

### 3.1 安装 Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 3.2 创建 OAuth Worker

新建文件 `worker/oauth.js`（参考 [Cloudflare OAuth Worker 示例](https://github.com/nicholasgasior/cloudflare-github-oauth-worker)），核心逻辑：

```js
export default {
  async fetch(request, env) {
    // 处理 CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      })
    }

    const { code } = await request.json()

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code
      })
    })

    const data = await response.json()

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}
```

### 3.3 部署并配置 Secret

```bash
# 部署 Worker
wrangler deploy worker/oauth.js --name wallpaper-oauth --compatibility-date 2026-03-17

# 设置环境变量（不会暴露到前端）
wrangler secret put GITHUB_CLIENT_ID --name wallpaper-oauth
wrangler secret put GITHUB_CLIENT_SECRET --name wallpaper-oauth
```

部署后得到 Worker URL，如 `https://wallpaper-oauth.your-subdomain.workers.dev`。

### 3.4 配置 OAuth Worker URL

在 Cloudflare Pages 环境变量中添加（见第五步）：

```
VITE_OAUTH_WORKER_URL=https://wallpaper-oauth.your-subdomain.workers.dev
```

---

## 第四步：获取 AI API Key

至少配置一个 AI Provider，推荐 ModelScope 或 Groq（均免费）。

### ModelScope 魔搭（推荐，免费）

1. 注册 [modelscope.cn](https://modelscope.cn)
2. 进入 **个人中心 → 访问令牌**
3. 创建新 Token，复制保存

### Groq AI（推荐，速度极快，免费）

1. 注册 [console.groq.com](https://console.groq.com)
2. 进入 **API Keys → Create API Key**
3. 复制保存

### NVIDIA NIM（可选）

1. 注册 [build.nvidia.com](https://build.nvidia.com)
2. 点击任意模型 → **Get API Key**
3. 复制保存

### Cloudflare Workers AI（可选）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages → Overview**，记录 **Account ID**
3. 进入 **My Profile → API Tokens → Create Token**
4. 选择 **Workers AI** 权限模板，创建并复制 Token
5. 部署 `worker/ai-proxy.js`（用于解决 CORS）：

```bash
wrangler deploy worker/ai-proxy.js --name ai-proxy --compatibility-date 2026-03-17
```

---

## 第五步：部署到 Cloudflare Pages

### 5.1 创建 Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages → Create → Pages**
3. 选择 **Connect to Git**，授权并选择你 fork 的仓库
4. 构建配置：
   - **Framework preset**：`Vue`
   - **Build command**：`pnpm build`
   - **Build output directory**：`dist`

### 5.2 配置环境变量

在 **Settings → Environment variables** 中添加以下变量：

| 变量名 | 说明 | 必填 |
| ------ | ---- | ---- |
| `VITE_OAUTH_WORKER_URL` | OAuth Worker URL（第三步获取） | ✅ |
| `VITE_MODELSCOPE_API_KEY` | ModelScope API Key | 至少填一个 AI Key |
| `VITE_GROQ_API_KEY` | Groq API Key | 至少填一个 AI Key |
| `VITE_NVIDIA_API_KEY` | NVIDIA NIM API Key | 可选 |
| `VITE_CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | 使用 CF AI 时必填 |
| `VITE_CLOUDFLARE_API_TOKEN` | Cloudflare API Token | 使用 CF AI 时必填 |
| `VITE_WORKER_URL` | AI Proxy Worker URL | 使用 CF AI 时必填 |

### 5.3 触发部署

保存环境变量后，在 **Deployments** 页面点击 **Retry deployment**，或推送一次代码触发自动部署。

---

## 第六步：修改项目配置

### 6.1 更新 OAuth Callback URL

部署完成后，你会得到一个 Pages 域名（如 `https://your-app.pages.dev`）。

回到 GitHub OAuth App 设置，将 **Authorization callback URL** 更新为：

```
https://your-app.pages.dev/callback
```

如果你绑定了自定义域名，也要同步更新。

### 6.2 检查 src/config/oauth.js

```js
// src/config/oauth.js
export const OAUTH_CONFIG = {
  // 确保 redirectUri 与 GitHub OAuth App 中配置的一致
  redirectUri: `${window.location.origin}/callback`
}
```

通常无需修改，`window.location.origin` 会自动适配当前域名。

---

## 本地开发配置

### 创建 .env.local

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入你自己的值：

```env
# OAuth Worker（本地开发也需要，否则无法登录）
VITE_OAUTH_WORKER_URL=https://wallpaper-oauth.your-subdomain.workers.dev

# AI Provider（至少填一个）
VITE_MODELSCOPE_API_KEY=ms-xxxxxxxxxxxxxxxxxxxxxxxx
VITE_GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Cloudflare AI（可选）
VITE_CLOUDFLARE_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_CLOUDFLARE_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_WORKER_URL=https://ai-proxy.your-subdomain.workers.dev
```

### 启动开发服务器

```bash
pnpm install
pnpm dev
```

> NVIDIA API 在本地会通过 Vite dev proxy 转发（`/nvidia-api` → `integrate.api.nvidia.com`），无需额外配置。

### 本地登录说明

GitHub OAuth 的 callback URL 必须与 OAuth App 中配置的完全一致。本地开发时需要在 GitHub OAuth App 中额外添加一条：

```
http://localhost:5173/callback
```

---

## 常见问题

### Q: 登录后跳转失败 / callback 报错

检查 GitHub OAuth App 中的 **Authorization callback URL** 是否与当前访问域名完全一致（包括协议和端口）。

### Q: 上传图片提示"权限不足"

确认登录的 GitHub 账号对图床仓库有 **write** 权限（Owner 或 Collaborator）。

### Q: AI 分析一直失败

1. 检查对应 Provider 的 API Key 是否正确填写
2. 检查 Key 是否已过期或超出免费额度
3. 打开浏览器控制台查看具体错误信息

### Q: 想换一个图床仓库

修改 `src/stores/config.js` 中的 `DEFAULT_CONFIG.owner` 和 `DEFAULT_CONFIG.repo`，重新部署即可。用户也可以在设置页面手动修改，配置会保存在 localStorage 中。

### Q: 想添加新的 AI Provider

参考 `src/services/ai/core/providers/` 目录下任意一个 Provider 实现，继承 `BaseAIProvider`，然后在 `index.js` 中注册，在 `classifier/config.js` 中添加模型配置即可。详见 [AI Provider 架构文档](./AI_PROVIDER.md)。
