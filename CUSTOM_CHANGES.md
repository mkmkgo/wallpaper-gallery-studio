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
