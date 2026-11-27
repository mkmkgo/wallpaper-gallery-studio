/**
 * 工作流目标仓常量（上传页工作流面板 / 上传后自动触发共用）
 *
 * 支持环境变量覆盖，缺省值与仓库拓扑一致：
 * - 工作流仓：wallpaper-gallery-workflow（repository_dispatch 入口）
 * - 前端仓：wallpaper-gallery（部署流）
 */
export const WORKFLOW_OWNER = import.meta.env.VITE_WORKFLOW_OWNER || 'mkmkgo'
export const WORKFLOW_REPO = import.meta.env.VITE_WORKFLOW_REPO || 'wallpaper-gallery-workflow'
export const FRONTEND_OWNER = import.meta.env.VITE_FRONTEND_OWNER || 'mkmkgo'
export const FRONTEND_REPO = import.meta.env.VITE_FRONTEND_REPO || 'wallpaper-gallery'
