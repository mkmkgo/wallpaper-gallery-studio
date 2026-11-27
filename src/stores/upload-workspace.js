import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const SERIES_STORAGE_KEY = 'wallpaper_admin_series'
const VALID_SERIES = ['desktop', 'mobile', 'avatar']

/**
 * 上次使用的系列（刷新后恢复）：
 * 工作流面板的待处理统计曾按当前 series 选仓查询，series 重置为 desktop
 * 会漏掉主仓新图；除聚合查询外，系列本身也应当记住。
 */
function readStoredSeries() {
  try {
    const stored = localStorage.getItem(SERIES_STORAGE_KEY)
    return VALID_SERIES.includes(stored) ? stored : 'desktop'
  } catch {
    return 'desktop'
  }
}

export const useUploadWorkspaceStore = defineStore('upload-workspace', () => {
  const uploadMode = ref('ai')
  const selectedModelKey = ref(null)
  const series = ref(readStoredSeries())
  const categoryL1 = ref('')
  const categoryL2 = ref('')

  const targetPath = computed(() => {
    if (!categoryL1.value) return ''
    const parts = ['wallpaper', series.value, categoryL1.value]
    if (categoryL2.value) {
      parts.push(categoryL2.value)
    }
    return parts.join('/')
  })

  function persistSeries() {
    try {
      localStorage.setItem(SERIES_STORAGE_KEY, series.value)
    } catch {
      // 隐私模式等存储不可用场景静默忽略
    }
  }

  function setTarget(newSeries, l1, l2 = '') {
    series.value = newSeries
    categoryL1.value = l1
    categoryL2.value = l2
    persistSeries()
  }

  function setSeries(newSeries) {
    series.value = newSeries
    persistSeries()
  }

  function setUploadMode(mode) {
    if (mode === 'ai' || mode === 'manual') {
      uploadMode.value = mode
    }
  }

  function setAiModel(modelKey) {
    selectedModelKey.value = modelKey
  }

  return {
    uploadMode,
    selectedModelKey,
    series,
    categoryL1,
    categoryL2,
    targetPath,
    setTarget,
    setSeries,
    setUploadMode,
    setAiModel
  }
})
