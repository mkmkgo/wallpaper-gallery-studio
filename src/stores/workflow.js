import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { githubService } from '@/services/github'

export const useWorkflowStore = defineStore('workflow', () => {
  // 状态
  const loading = ref(false)
  const triggering = ref(false)
  const polling = ref(false)

  // 待处理图片信息
  const pendingInfo = ref({
    pendingCount: 0,
    pendingFiles: [],
    latestTag: null,
    latestTagInfo: null,
    message: null,
    error: null
  })

  // stats.json 统计数据
  const statsData = ref(null)

  // 工作流运行状态
  const workflowStatus = ref({
    hasRunning: false,
    runningWorkflow: null,
    latestRun: null,
    justTriggered: false,
    triggerTime: null // 触发时间
  })

  // 前端部署（gallery 仓自动部署链路）运行状态
  const frontendStatus = ref({ hasRunning: false, latestRun: null })

  // 本次会话上传成功的文件数
  const sessionUploadCount = ref(0)

  // 轮询定时器
  let pollTimer = null
  // 被动状态监视定时器（CI 自动触发场景，进页面常驻低频刷新）
  let passiveTimer = null
  // 延迟定时器（用于触发后延迟开始轮询、完成后延迟刷新等）
  let delayTimers = []
  // 轮询配置
  let pollConfig = { owner: '', repo: '', imageOwner: '', imageRepo: '', branch: '' }
  // 轮询开始时间
  let pollStartTime = null
  // 最大轮询时间（30分钟）
  const MAX_POLL_TIME = 30 * 60 * 1000

  // 添加延迟定时器（便于统一清理）
  function addDelayTimer(callback, delay) {
    const timer = setTimeout(() => {
      // 执行后从列表中移除
      delayTimers = delayTimers.filter(t => t !== timer)
      callback()
    }, delay)
    delayTimers.push(timer)
    return timer
  }

  // 清理所有延迟定时器
  function clearDelayTimers() {
    delayTimers.forEach(timer => clearTimeout(timer))
    delayTimers = []
  }

  // 计算属性：是否可以触发
  const canTrigger = computed(() => {
    // 正在加载或触发中
    if (loading.value || triggering.value) return false
    // 刚触发或正在运行
    if (workflowStatus.value.justTriggered || workflowStatus.value.hasRunning) return false
    // 没有待处理图片
    if (pendingInfo.value.pendingCount === 0) return false
    return true
  })

  // 计算属性：是否正在运行（包括刚触发）
  const isRunning = computed(() => {
    return workflowStatus.value.justTriggered || workflowStatus.value.hasRunning
  })

  // 计算属性：状态文本
  const statusText = computed(() => {
    if (workflowStatus.value.justTriggered) {
      return '已触发，等待启动...'
    }
    if (workflowStatus.value.hasRunning) {
      const run = workflowStatus.value.runningWorkflow
      if (run?.status === 'queued') return '排队中...'
      if (run?.status === 'in_progress') return '运行中...'
      return '处理中...'
    }
    return null
  })

  // 刷新待处理图片信息
  async function refreshPendingInfo(owner, repo, branch = 'main') {
    loading.value = true
    try {
      const info = await githubService.getPendingImages(owner, repo, branch)
      pendingInfo.value = info
      return info
    } catch (error) {
      pendingInfo.value.error = error.message
      throw error
    } finally {
      loading.value = false
    }
  }

  // 刷新 stats.json 数据
  async function refreshStatsData(owner, repo, branch = 'main') {
    try {
      const data = await githubService.getStats(owner, repo, branch)
      statsData.value = data
      return data
    } catch (error) {
      console.error('Failed to refresh stats data:', error)
      return null
    }
  }

  // 刷新工作流状态
  async function refreshWorkflowStatus(workflowOwner, workflowRepo) {
    try {
      const status = await githubService.hasRunningWorkflow(workflowOwner, workflowRepo)

      // 如果检测到运行中的工作流
      if (status.hasRunning) {
        workflowStatus.value = {
          ...status,
          justTriggered: false, // 已经开始运行，清除刚触发标记
          triggerTime: workflowStatus.value.triggerTime
        }
      } else {
        // 没有运行中的工作流
        const wasRunning = workflowStatus.value.hasRunning || workflowStatus.value.justTriggered

        workflowStatus.value = {
          ...status,
          justTriggered: false,
          triggerTime: null
        }

        // 如果之前在运行，现在完成了，刷新相关数据
        if (wasRunning && pollConfig.imageOwner) {
          console.log('[WorkflowStore] 工作流完成，刷新数据...')
          // 延迟刷新，等待 GitHub API 同步
          addDelayTimer(async () => {
            try {
              await Promise.all([
                refreshPendingInfo(pollConfig.imageOwner, pollConfig.imageRepo, pollConfig.branch),
                refreshStatsData(pollConfig.imageOwner, pollConfig.imageRepo, pollConfig.branch)
              ])
              console.log('[WorkflowStore] 数据刷新完成')
            } catch (e) {
              console.error('[WorkflowStore] 数据刷新失败:', e)
            }
          }, 1500)
        }
      }

      return status
    } catch (error) {
      console.error('Failed to refresh workflow status:', error)
      return workflowStatus.value
    }
  }

  // 触发工作流
  async function triggerWorkflow(
    workflowOwner,
    workflowRepo,
    message = '',
    publisher = '',
    eventType = 'process-wallpapers'
  ) {
    if (!canTrigger.value) return false

    triggering.value = true
    try {
      await githubService.triggerWorkflow(workflowOwner, workflowRepo, eventType, {
        message: message || `chore: 处理 ${pendingInfo.value.pendingCount} 张新图片`,
        publisher: publisher || ''
      })

      // 立即标记为刚触发状态
      workflowStatus.value.justTriggered = true
      workflowStatus.value.triggerTime = Date.now()

      // 触发成功后开始轮询状态
      addDelayTimer(() => {
        startPolling(workflowOwner, workflowRepo)
      }, 3000)

      return true
    } catch (error) {
      console.error('Failed to trigger workflow:', error)
      throw error
    } finally {
      triggering.value = false
    }
  }

  // 回滚到上一个 tag（触发工作流进行完整回滚）
  async function rollbackLastRelease(
    imageOwner,
    imageRepo,
    workflowOwner,
    workflowRepo,
    tagName = '',
    eventType = ''
  ) {
    loading.value = true
    try {
      const result = await githubService.rollbackToLastTag(
        imageOwner,
        imageRepo,
        workflowOwner,
        workflowRepo,
        tagName,
        eventType || 'rollback-release'
      )

      // 标记为刚触发状态，开始轮询
      workflowStatus.value.justTriggered = true
      workflowStatus.value.triggerTime = Date.now()

      addDelayTimer(() => {
        startPolling(workflowOwner, workflowRepo)
      }, 3000)

      return result
    } catch (error) {
      console.error('Failed to rollback:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 触发前端部署
  async function triggerFrontendDeploy(frontendOwner, frontendRepo) {
    loading.value = true
    try {
      const workflows = ['deploy.yml', 'deploy-edgeone.yml', 'deploy-edgeone-cn.yml']
      const results = await Promise.allSettled(
        workflows.map(workflow =>
          githubService.dispatchWorkflowByName(frontendOwner, frontendRepo, workflow)
        )
      )

      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length > 0) {
        const errors = failed
          .map((f, i) => `${workflows[i]}: ${f.reason?.message || f.reason}`)
          .join(', ')
        throw new Error(`部分工作流触发失败: ${errors}`)
      }

      return true
    } catch (error) {
      console.error('Failed to trigger frontend deploy:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 开始轮询工作流状态
  function startPolling(workflowOwner, workflowRepo, interval = 5000) {
    stopPolling()
    polling.value = true
    pollStartTime = Date.now()

    // 保存配置用于完成后刷新
    pollConfig.owner = workflowOwner
    pollConfig.repo = workflowRepo

    console.log('[WorkflowStore] 开始轮询工作流状态，间隔:', interval, 'ms')

    // 立即检查一次
    refreshWorkflowStatus(workflowOwner, workflowRepo)

    pollTimer = setInterval(async () => {
      // 检查是否超过最大轮询时间
      const elapsed = Date.now() - pollStartTime
      if (elapsed > MAX_POLL_TIME) {
        console.warn('[WorkflowStore] 轮询超时（30分钟），自动停止')
        workflowStatus.value.justTriggered = false
        workflowStatus.value.triggerTime = null
        stopPolling()
        return
      }

      const status = await refreshWorkflowStatus(workflowOwner, workflowRepo)

      // 如果没有运行中的工作流且不是刚触发状态，停止轮询
      if (!status.hasRunning && !workflowStatus.value.justTriggered) {
        console.log('[WorkflowStore] 工作流已完成，停止轮询')
        stopPolling()
      }

      // 超时保护：如果触发超过 10 分钟还没检测到运行，停止轮询
      if (workflowStatus.value.justTriggered && workflowStatus.value.triggerTime) {
        const triggerElapsed = Date.now() - workflowStatus.value.triggerTime
        if (triggerElapsed > 10 * 60 * 1000) {
          console.warn('[WorkflowStore] 工作流触发超时（10分钟），停止轮询')
          workflowStatus.value.justTriggered = false
          workflowStatus.value.triggerTime = null
          stopPolling()
        }
      }
    }, interval)
  }

  // 停止轮询
  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
      console.log('[WorkflowStore] 停止轮询')
    }
    polling.value = false
    pollStartTime = null
  }

  // 被动状态监视：CI 自动触发工作流后，用户不再手动点触发按钮，
  // startPolling 不会启动，状态面板会永远停在首次快照。这里进页面即常驻低频刷新。
  // 不复用 startPolling：它有「无运行且非刚触发就 stopPolling」逻辑，被动模式下会立刻自杀。
  // 每 tick 两个仓各一次 GET /actions/runs，15s 间隔合计约 480 次/小时，
  // 远低于 GitHub OAuth token 5000 次/小时限额；token 复用现有 setToken() 注入值。
  function startPassiveWatch(
    workflowOwner,
    workflowRepo,
    frontendOwner,
    frontendRepo,
    interval = 15000
  ) {
    stopPassiveWatch()
    if (!workflowOwner || !workflowRepo) return

    const tick = async () => {
      await refreshWorkflowStatus(workflowOwner, workflowRepo)
      if (frontendOwner && frontendRepo) {
        try {
          // gallery 仓还跑着 Export Stats / Watch CDN Tag 等定时任务，
          // hasRunningWorkflow() 会把它们也算进来（runs[0] 甚至可能不是部署流），
          // 导致「前端部署」显示无关状态。这里只保留三条部署流再取样。
          const data = await githubService.getWorkflowRuns(frontendOwner, frontendRepo, 10)
          const deployRuns = (data?.workflow_runs || []).filter(run =>
            /^Deploy to /i.test(run.name || '')
          )
          const running = deployRuns.find(
            run => run.status === 'queued' || run.status === 'in_progress'
          )
          frontendStatus.value = {
            hasRunning: !!running,
            latestRun: deployRuns[0] || null
          }
        } catch (e) {
          console.warn('[WorkflowStore] 查询前端部署状态失败:', e)
        }
      }
    }

    tick()
    passiveTimer = setInterval(tick, interval)
    console.log('[WorkflowStore] 启动被动状态监视，间隔:', interval, 'ms')
  }

  function stopPassiveWatch() {
    if (passiveTimer) {
      clearInterval(passiveTimer)
      passiveTimer = null
    }
  }

  // 设置图床仓库配置（用于完成后刷新）
  function setImageRepoConfig(owner, repo, branch) {
    pollConfig.imageOwner = owner
    pollConfig.imageRepo = repo
    pollConfig.branch = branch
  }

  // 增加会话上传计数
  function addSessionUpload(count = 1) {
    sessionUploadCount.value += count
  }

  // 重置会话上传计数
  function resetSessionUpload() {
    sessionUploadCount.value = 0
  }

  // 清理所有资源
  function cleanup() {
    console.log('[WorkflowStore] 清理资源')
    stopPolling()
    stopPassiveWatch()
    clearDelayTimers()
    // 重置状态
    workflowStatus.value = {
      hasRunning: false,
      runningWorkflow: null,
      latestRun: null,
      justTriggered: false,
      triggerTime: null
    }
    pollStartTime = null
  }

  return {
    // 状态
    loading,
    triggering,
    polling,
    pendingInfo,
    workflowStatus,
    frontendStatus,
    sessionUploadCount,
    statsData,
    // 计算属性
    canTrigger,
    isRunning,
    statusText,
    // 方法
    refreshPendingInfo,
    refreshStatsData,
    refreshWorkflowStatus,
    triggerWorkflow,
    triggerFrontendDeploy,
    rollbackLastRelease,
    startPolling,
    stopPolling,
    startPassiveWatch,
    stopPassiveWatch,
    setImageRepoConfig,
    addSessionUpload,
    resetSessionUpload,
    cleanup
  }
})
