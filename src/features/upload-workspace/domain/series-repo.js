/**
 * 分仓路由（2026-10-22 图床分仓）
 *
 * desktop 系列已迁至独立公开仓 nuanXinProPic-desktop（tag v2.0.0 起独立编号），
 * mobile / avatar 仍写主仓。每条图片数据自带 repo + cdnTag 字段（前端已按此路由），
 * Studio 侧通过本模块把上传/读取/工作流触发按 series 解析到对应仓库。
 *
 * 纯函数，无副作用，可单测。
 */

/**
 * 按 series 解析目标仓库
 * @param {{ owner?: string, repo?: string, seriesRepos?: Record<string, { owner?: string, repo?: string }> }} config
 * @param {string} series - 'desktop' | 'mobile' | 'avatar' | ''
 * @returns {{ owner: string, repo: string }} 分仓缺省回退主仓配置
 */
export function resolveSeriesRepo(config = {}, series = '') {
  const owner = config.owner || ''
  const repo = config.repo || ''
  const override = series ? config.seriesRepos?.[series] : null

  if (override && override.repo) {
    return {
      owner: override.owner || owner,
      repo: override.repo
    }
  }

  return { owner, repo }
}

/**
 * 按 series 解析 workflow repository_dispatch 事件类型
 * desktop 走分仓专用流水线（workflow 仓 process-wallpapers-desktop.yml），
 * 其余系列走主流水线 process-wallpapers.yml。
 * @param {string} series
 * @returns {string}
 */
export function resolveSeriesWorkflowEvent(series = '') {
  if (series === 'desktop') {
    return 'process-wallpapers-desktop'
  }
  return 'process-wallpapers'
}
