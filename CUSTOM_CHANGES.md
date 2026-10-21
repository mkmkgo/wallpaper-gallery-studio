# 自定义修改记录 & 同步指南

> 本文档记录了 fork 仓库相对于上游 (`IT-NuanxinPro/wallpaper-gallery-studio`) 的所有自定义修改，
> 以便在同步上游更新时能准确合并，避免冲突和功能丢失。

---

## 修改版本：v1.0.0-custom

**修改日期**：2026-05-06

### 修改概述

修复 AI 智能分类功能中"所有图片被分类到通用"的问题，以及相关的可靠性改进。

---

## 修改文件清单

### 1. `src/features/upload-workspace/application/create-upload-file-lifecycle-service.js`

**修改类型**：核心修复

**修改内容**：

- **新增** `RateLimiter` 导入和 `PROVIDER_RATE_LIMITS` 配置
- **新增** `getRateLimiter(provider)` 工具函数
- **重写** `analyzeFiles()` 方法：
  - 原实现：直接并发调用 `classifierAnalyze`，无速率限制，容易触发 API 429 错误
  - 新实现：使用 `RateLimiter` 控制请求频率，每个 Provider 有独立的速率配置
  - 新增 `failedCount` 统计，并在控制台输出批量分析结果
  - 返回值新增 `failedCount` 字段

**速率限制配置**：

| Provider   | 最大并发 | 最小间隔 | 重试次数 | 重试延迟 |
| ---------- | -------- | -------- | -------- | -------- |
| groq       | 2        | 2500ms   | 3        | 4000ms   |
| modelscope | 3        | 1500ms   | 3        | 3000ms   |
| cloudflare | 2        | 2000ms   | 2        | 3000ms   |

**同步注意事项**：

- 如果上游修改了 `analyzeFiles` 方法，需要保留速率限制逻辑
- 如果上游新增了 Provider，需要在 `PROVIDER_RATE_LIMITS` 中添加对应配置
- `analyzeFiles` 返回值新增了 `failedCount`，如果上游调用方依赖返回值需注意兼容

---

### 2. `src/services/ai/core/providers/groq-provider.js`

**修改类型**：Bug 修复

**修改内容**：

- `max_completion_tokens` 从硬编码 `1024` 改为 `maxTokens || 1024`
- `credentials` 解构新增 `maxTokens` 字段

**原代码**：

```js
const { apiKey, model } = credentials
// ...
max_completion_tokens: 1024
```

**新代码**：

```js
const { apiKey, model, maxTokens } = credentials
// ...
max_completion_tokens: maxTokens || 1024
```

**同步注意事项**：

- 如果上游修改了 Groq Provider 的请求参数结构，需保留 `maxTokens` 的动态读取
- 如果上游修改了 `max_completion_tokens` 的硬编码值，应改为从模型配置中读取

---

### 3. `src/services/ai/core/providers/modelscope-provider.js`

**修改类型**：Bug 修复（与 Groq 同类问题）

**修改内容**：

- `max_tokens` 从硬编码 `2048` 改为 `maxTokens || 2048`
- `credentials` 解构新增 `maxTokens` 字段

**原代码**：

```js
const { apiKey, model } = credentials
// ...
max_tokens: 2048
```

**新代码**：

```js
const { apiKey, model, maxTokens } = credentials
// ...
max_tokens: maxTokens || 2048
```

**同步注意事项**：同 Groq Provider

---

### 4. `src/services/ai/classifier/service.js`

**修改类型**：Bug 修复（配合 Provider 的 maxTokens 修改）

**修改内容**：

- `analyzeImage()` 中传递给 Provider 的 `credentials` 新增 `maxTokens: modelConfig.maxTokens`

**原代码**：

```js
credentials: {
  ...credentials,
  model: modelConfig.id
}
```

**新代码**：

```js
credentials: {
  ...credentials,
  model: modelConfig.id,
  maxTokens: modelConfig.maxTokens
}
```

**同步注意事项**：

- 如果上游修改了 `analyzeImage` 的 credentials 传递逻辑，需保留 `maxTokens` 字段

---

### 5. `src/services/ai/classifier/prompts.js`

**修改类型**：可靠性修复

**修改内容**：

- `buildPromptWithLatestCategories()` 新增 try-catch 容错
- 新增 `getFallbackUploadCategoryTree` 导入
- 当 `getUploadCategoryTree()` 失败时，自动回退到本地分类配置

**原代码**：

```js
const categoryTree = await getUploadCategoryTree(options)
return buildPrompt(templateId, primaryCategory, customPrompt, provider, categoryTree)
```

**新代码**：

```js
let categoryTree = null
try {
  categoryTree = await getUploadCategoryTree(options)
} catch (error) {
  console.error('[Prompts] 获取分类树失败，使用本地回退:', error.message)
  categoryTree = getFallbackUploadCategoryTree()
}
return buildPrompt(templateId, primaryCategory, customPrompt, provider, categoryTree)
```

**同步注意事项**：

- 如果上游修改了 `buildPromptWithLatestCategories`，需保留 try-catch 容错逻辑
- 如果上游修改了导入语句，需保留 `getFallbackUploadCategoryTree` 的导入

---

### 6. `src/components/upload/UploadPanel/UploadFileItem.vue`

**修改类型**：UI 改进

**修改内容**：

- Tooltip 的 `disabled` 条件修改：当有 `aiMetadata.error` 时也显示 tooltip
- 新增 AI 分析失败的错误信息展示区域（红色高亮）
- 新增 AI 分析失败的视觉标记（⚠ 橙色徽章）
- 新增 `.upload-file-item__badge--ai-error` 样式

**同步注意事项**：

- 如果上游重写了 `UploadFileItem.vue`，需保留 AI 错误展示逻辑
- 如果上游修改了 tooltip 结构，需保留 error 展示区域

---

## 同步上游源码的步骤

### 1. 添加上游远程仓库（首次）

```bash
git remote add upstream https://github.com/IT-NuanxinPro/wallpaper-gallery-studio.git
```

### 2. 获取上游最新代码

```bash
git fetch upstream
```

### 3. 查看差异

```bash
# 查看上游有哪些新提交
git log --oneline main..upstream/main

# 查看具体文件差异
git diff main..upstream/main -- <文件路径>
```

### 4. 合并上游代码

```bash
git merge upstream/main
```

### 5. 解决冲突时的注意事项

合并时如果出现冲突，重点关注以下文件：

| 文件                                      | 冲突处理策略                                  |
| ----------------------------------------- | --------------------------------------------- |
| `create-upload-file-lifecycle-service.js` | **保留速率限制逻辑**，合并上游新功能          |
| `groq-provider.js`                        | **保留 maxTokens 动态读取**，合并上游其他修改 |
| `modelscope-provider.js`                  | **保留 maxTokens 动态读取**，合并上游其他修改 |
| `classifier/service.js`                   | **保留 maxTokens 传递**，合并上游其他修改     |
| `prompts.js`                              | **保留 try-catch 容错**，合并上游新模板       |
| `UploadFileItem.vue`                      | **保留 AI 错误展示**，合并上游 UI 修改        |

### 6. 验证合并结果

```bash
# 安装依赖
pnpm install

# 构建验证
npx vite build

# 启动开发服务器测试
pnpm dev
```

---

## 问题根因分析（供参考）

### 现象

上传图片后，AI 分析有时正常分类，有时全部归到"通用"分类。

### 根因

1. **`analyzeFiles` 缺少速率限制器**（核心原因）
   - 原实现直接并发调用 AI API，无任何间隔控制
   - Groq API 有严格的速率限制（30000 TPM, 14400 RPD）
   - 批量上传时极易触发 429 错误，导致所有后续请求失败
   - 失败后静默回退到"通用"分类，用户看不到错误信息

2. **Groq Provider 硬编码 `max_completion_tokens: 1024`**
   - 复杂的 desktop Prompt 模板要求返回包含多个字段的 JSON
   - 1024 tokens 可能不够，导致 JSON 被截断、解析失败

3. **ModelScope Provider 硬编码 `max_tokens: 2048`**
   - 同样的问题，虽然 2048 相对充裕，但应从模型配置中读取

4. **`buildPromptWithLatestCategories` 无容错**
   - 如果从 GitHub 获取分类树失败，直接抛出异常
   - 导致整个 AI 分析流程中断

5. **AI 分析失败时错误信息不可见**
   - 错误记录在 `aiMetadata.error` 中，但 UI 不展示
   - 用户误以为 AI 只是分类不准，实际是分析完全失败

---

## 同步轮次：v1.1.0-custom（2026-10-16）

**同步对象**：上游 tag `v1.1.0`（`888e493`，fork 点 `d11d683` 之后 6 条提交全部合入）
**沙箱分支**：`sync/upstream-v1.1.0`（未合回 main、未推送，待验证与用户确认）
**基线指针**：`upstream-base` = `d11d683`

### 本轮冲突处置（4 处）

| 文件                                      | 解法                                                                                                                                                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create-upload-file-lifecycle-service.js` | `analyzeFiles` 整体采用上游任务中心架构（task-store 建任务 + `resumeAiTaskQueue` 驱动）；**删除本地 RateLimiter 三件套**（`PROVIDER_RATE_LIMITS`/`getRateLimiter`/import）——上游串行队列 + 2s/4s/8s 指数退避已覆盖 429 场景 |
| `classifier/config.js`                    | 整体取上游：默认 Provider ZHIPU + `zhipu-glm-4v-flash`（1024/0.7）；本地 Scout 8192 参数与 ModelScope 默认均被 GLM 决策取代                                                                                                 |
| `stores/upload.js`                        | Provider 优先级取上游（ZHIPU:0 / GROQ:1）                                                                                                                                                                                   |
| `providers/modelscope-provider.js`        | `git rm` 确认删除（GLM 决策，合并后全仓零引用）                                                                                                                                                                             |

### 保留/移植的本地改进

- **友好错误提示移植**：本地「网络失败→建议切换 Provider」「429→请稍后再试」文案移入上游
  `task-runner.js` 的 `humanizeTaskError()`，wording 更新为「或切换到智谱 GLM（国内可用）」
- **UploadFileItem.vue 错误 UI**：随合并保留（`aiMetadata.error` 展示）；上游失败流程会置空
  aiMetadata，该路径变为惰性代码，不报错、不影响任务中心徽章
- **部署双触发**（`stores/workflow.js` 触发 EdgeOne CN 部署）：上游从未触碰，零冲突保留

### 顺手修的既有红线

- `src/components/upload/WorkflowPanel.vue:335/337`：`LEGACY_WORKFLOW_OWNER`/`LEGACY_FRONTEND_OWNER`
  由 `IT-NuanxinPro` 改为 `mkmkgo`（env 未配时的回退目标不能是作者账号）
- `src/services/github.test.js`：测试 fixture 中的 owner 由 `IT-NuanxinPro` 改为 `mkmkgo`

### 自动合并（无冲突，语义已复核）

- `providers/index.js` / `core/index.js` / `credentials.js` / `UploadHeader.vue` /
  `.env.example`（`VITE_ZHIPU_API_KEY`）/ `package.json`（version 1.1.0）/
  `UploadPanel.vue`（挂载 AITaskCenter）/ 全部上游新增文件（zhipu-provider、task-runner、
  task-storage、ai-tasks store、AITaskCenter.vue 等）

### 遗留风险

1. **GLM key 未配置时任务中心静默暂停**（task-runner 设计行为，不报错也不跑）——
   部署环境需配 `VITE_ZHIPU_API_KEY`（open.bigmodel.cn 申请）
2. `zhipu-provider.js` 的 `max_tokens` 硬编码 1024——若 GLM 输出被截断需改为从模型配置读取
3. 上游未合入 main 的大重构 `529f8ef`（上传工作区重建，2619 行）落地后需再同步一轮

---

## 同步轮次追加：AI CORS 代理（2026-10-22）

### 背景与根因

浏览器直连 `https://open.bigmodel.cn` 被 CORS 拦截：

```
Access to fetch at 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
from origin 'https://wall.pj365.qzz.io' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present
```

但**服务端 curl 用同一个 Origin 请求，智谱每次都正常返回 `access-control-allow-origin`**。
即：智谱侧放行、浏览器侧拿不到 → 是「浏览器→智谱」链路上的中间环节拦截，
**改前端无法根治**，只能让请求不再跨域。

### 方案

链路改为 **浏览器 → 自建 Cloudflare Worker（自带 CORS 头）→ 厂商接口**，
第二段是服务端到服务端，不存在跨域。

Worker 地址：`https://wallpaper-ai-proxy.1109008002.workers.dev`（路径前缀 `/zhipu`）

### 改动清单

| 文件                               | 类型                     | 同步冲突风险             |
| ---------------------------------- | ------------------------ | ------------------------ |
| `worker/ai-cors-proxy.js`          | 🆕 **新建**              | **零**（上游无同名文件） |
| `providers/zhipu-provider.js`      | 改（标 `[LOCAL]`）       | 低（1 处，构造函数内）   |
| `providers/groq-provider.js`       | 改（标 `[LOCAL]`，可选） | 低                       |
| `providers/modelscope-provider.js` | 改（标 `[LOCAL]`，可选） | 低                       |
| `.env.example`                     | 改（补充说明）           | 低                       |

### 关键实现细节（上游合并时需保留）

1. **`worker/ai-cors-proxy.js`**
   - 多厂商透传：`/zhipu/*`→open.bigmodel.cn、`/groq/*`→api.groq.com、`/modelscope/*`→api-inference.modelscope.cn
   - 处理 OPTIONS 预检，**必须放行 `authorization, content-type`**（否则预检仍失败）
   - 透传 `Authorization` 头，Worker **不存储任何密钥**
2. **`zhipu-provider.js`**
   - 默认走代理：`DEFAULT_ZHIPU_BASE_URL`
   - `normalizeZhipuBase()` **自动补 `/zhipu` 后缀**——Worker 靠 URL 首段路径识别厂商，
     少了后缀会返回「未知的 provider」。对环境变量填错（填成裸 host）容错。
   - 优先级：`config.baseUrl` → `VITE_ZHIPU_BASE_URL` → 代理默认值
3. 想改回直连：设 `VITE_ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4`

### 同步上游时的处理

- `worker/ai-cors-proxy.js` 是**全新文件**，上游永远不会碰 → 直接保留
- 三个 provider 的改动都在**构造函数内、带 `[LOCAL]` 注释** →
  若上游也改了这几行，冲突范围就是那 1~3 行，手工保留 `[LOCAL]` 分支即可
- 判据：`git diff upstream-base..main` 可列出全部自有补丁

### 已验证

- Node 22 实跑 Worker：预检 204+`ACAO:*`；假 key 转发拿到智谱
  `401「令牌已过期或验证不正确」`且带 CORS 头；三家 URL 映射正确
- 三种环境变量场景（不填 / 填裸地址 / 填对）构建产物均含 `workers.dev/zhipu`
- `pnpm build` 通过；`dist` 内已无 `open.bigmodel.cn` 硬编码
