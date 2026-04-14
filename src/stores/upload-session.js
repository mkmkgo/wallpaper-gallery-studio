import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUploadSessionStore = defineStore('upload-session', () => {
  const files = ref([])
  const uploading = ref(false)
  const currentFileIndex = ref(-1)
  const aiAnalyzing = ref(false)
  const aiAnalyzingCount = ref(0)
  const metadataStatus = ref('idle')
  const metadataError = ref(null)
  const metadataPendingPath = ref('')
  const metadataRetryFileIds = ref([])

  const totalProgress = computed(() => {
    if (files.value.length === 0) return 0
    const total = files.value.reduce((sum, file) => sum + file.progress, 0)
    return Math.round(total / files.value.length)
  })

  const pendingFiles = computed(() => files.value.filter(file => file.status === 'pending'))
  const uploadingFiles = computed(() => files.value.filter(file => file.status === 'uploading'))
  const successFiles = computed(() => files.value.filter(file => file.status === 'success'))
  const errorFiles = computed(() => files.value.filter(file => file.status === 'error'))

  function setFiles(nextFiles) {
    files.value = nextFiles
  }

  function appendFiles(nextFiles) {
    files.value.push(...nextFiles)
  }

  function removeFile(id) {
    const index = files.value.findIndex(file => file.id === id)
    if (index > -1) {
      files.value.splice(index, 1)
    }
  }

  function removeFiles(ids) {
    files.value = files.value.filter(file => !ids.includes(file.id))
  }

  function clearFiles() {
    files.value = []
  }

  function clearSuccessFiles() {
    const successIds = files.value.filter(file => file.status === 'success').map(file => file.id)
    files.value = files.value.filter(file => file.status !== 'success')
    return successIds.length
  }

  return {
    files,
    uploading,
    currentFileIndex,
    aiAnalyzing,
    aiAnalyzingCount,
    metadataStatus,
    metadataError,
    metadataPendingPath,
    metadataRetryFileIds,
    totalProgress,
    pendingFiles,
    uploadingFiles,
    successFiles,
    errorFiles,
    setFiles,
    appendFiles,
    removeFile,
    removeFiles,
    clearFiles,
    clearSuccessFiles
  }
})
