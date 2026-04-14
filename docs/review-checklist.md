# 上传页架构重构审查清单

这份清单用于在提交或开源前，快速审查本轮上传页架构重构是否达到预期。

## 10 分钟 Checklist

### 1. 检查兼容 facade 是否成立

文件：

- `src/stores/upload.js`

要点：

- 顶部注释是否与实际实现一致
- 是否主要负责转发和组装
- 是否还残留大量底层业务逻辑

判断标准：

- `uploadStore` 应是兼容 facade，而不是新的“大而全 store”

### 2. 检查状态拆分是否清晰

文件：

- `src/stores/upload-workspace.js`
- `src/stores/upload-session.js`

要点：

- `upload-workspace` 是否只负责选择状态
- `upload-session` 是否只负责上传会话状态

判断标准：

- 一个只管“选什么”
- 一个只管“上传过程现在是什么状态”

### 3. 检查上传页是否仍然直连基础设施

文件：

- `src/views/UploadView.vue`

要点：

- import 是否还直接依赖 `githubService`、`localStorageService`
- 页面函数是否仍在处理底层目录、仓库、缓存细节

判断标准：

- 上传页应主要面向 facade / workspace infrastructure，而不是基础设施实现

### 4. 检查 GitHub 适配边界

文件：

- `src/features/upload-workspace/infrastructure/create-github-upload-workspace-repository.js`

要点：

- manifest 读取
- 分类目录读取
- 图片上传
- 文件创建/删除

判断标准：

- 上层只关心“仓库能力”
- 不应感知 GitHub API 细节

### 5. 检查文件生命周期服务

文件：

- `src/features/upload-workspace/application/create-upload-file-lifecycle-service.js`

要点：

- 文件准备
- AI metadata 应用
- target path 更新
- 批量应用 AI 推荐

判断标准：

- `wallpaper/${series}/${l1}/${l2}` 的路径构建逻辑应统一

### 6. 检查上传会话服务

文件：

- `src/features/upload-workspace/application/create-upload-session-service.js`

要点：

- 单文件上传
- 批量上传
- metadata pending 文件生成
- 错误映射

判断标准：

- 上传主链应在 service 中闭环，而不是回流到 store

### 7. 检查 manifest schema 校验

文件：

- `src/features/upload-workspace/domain/upload-workspace-manifest.js`

要点：

- manifest 顶层结构是否合法
- `categories` 是否强制为对象
- 分类项是否强制要求 `label`

判断标准：

- 不允许坏 manifest 进入系统主链

### 8. 检查 prompt 是否真正 manifest 优先

文件：

- `src/services/ai/classifier/prompts.js`

要点：

- `buildVariables()` 在传入 manifest tree 时是否只按 manifest 输出分类候选

判断标准：

- 不应偷偷混入本地静态三级分类

### 9. 检查开源前默认配置是否去私有化

文件：

- `src/app/config/app-config.js`
- `src/stores/config.js`
- `src/config/oauth.js`
- `src/components/upload/WorkflowPanel.vue`
- `src/views/LoginView.vue`

要点：

- 默认仓库是否仍指向私有仓库
- OAuth Client ID / Worker 地址是否仍写死
- workflow/front-end repo 是否仍写死
- 登录页品牌仓库链接是否动态

判断标准：

- 开源后的默认配置不能继续指向私有资源

### 10. 检查文档口径是否统一

文件：

- `docs/self-hosting.md`
- `docs/examples/upload-workspace.manifest.example.json`
- `README.md`

要点：

- 是否明确推荐“环境变量 + 设置页 + 远端 manifest”
- 是否还在引导用户改源码默认值
- manifest 示例是否能直接拿来改

判断标准：

- 新用户应优先通过配置和目标仓库完成接入，而不是 fork 后改源码

## 只看 3 个文件时

如果时间不够，优先看：

1. `src/stores/upload.js`
2. `src/features/upload-workspace/domain/upload-workspace-manifest.js`
3. `docs/self-hosting.md`

这 3 个文件足以判断：

- 上传页主架构是否真的拆清楚
- manifest 是否真的成为主数据源
- 开源自托管路径是否已经讲明白

## 审查结论建议

通过审查时，建议你给自己一个简单结论：

- 架构边界：是否清楚
- manifest 策略：是否接受
- 开源默认配置：是否安全
- 文档入口：是否够明确

如果其中任一项答案是否定的，就优先修这一项，再考虑提交或公开。
