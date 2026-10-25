<template>
  <el-dialog v-model="visible" title="AI 智能分析" width="800px" :close-on-click-modal="false">
    <div class="ai-analysis-modal">
      <!-- 分析进度 -->
      <div v-if="analyzing" class="analyzing">
        <el-progress type="circle" :percentage="progress" :width="120">
          <template #default="{ percentage }">
            <span class="percentage-value">{{ percentage }}%</span>
            <span class="percentage-label">分析中</span>
          </template>
        </el-progress>
        <p class="analyzing-text">AI 正在分析图片内容...</p>
      </div>

      <!-- 分析结果 -->
      <div v-else-if="analysisResult" class="analysis-result">
        <!-- 图片预览 -->
        <div class="image-preview">
          <img :src="imagePreview" alt="预览" />
        </div>

        <!-- 分析详情 -->
        <div class="analysis-details">
          <!-- 文件名建议 -->
          <div class="section">
            <h3>📝 文件名建议</h3>
            <el-radio-group v-model="selectedFilename" class="filename-options">
              <el-radio
                v-for="(name, index) in analysisResult.filenameSuggestions"
                :key="index"
                :label="name"
                border
              >
                {{ name }}
              </el-radio>
            </el-radio-group>
            <el-input
              v-model="customFilename"
              placeholder="或输入自定义文件名"
              class="custom-input"
            >
              <template #prepend>自定义</template>
            </el-input>
          </div>

          <!-- 分类建议 -->
          <div class="section">
            <h3>📁 分类建议</h3>
            <div class="category-suggestion">
              <el-tag type="primary" size="large">
                {{ analysisResult.categorySuggestion.primary }}
              </el-tag>
              <el-icon><ArrowRight /></el-icon>
              <el-tag type="success" size="large">
                {{ analysisResult.categorySuggestion.secondary }}
              </el-tag>
              <el-tag :type="confidenceType" size="small" class="confidence-tag">
                置信度: {{ (analysisResult.categorySuggestion.confidence * 100).toFixed(0) }}%
              </el-tag>
            </div>

            <!-- 手动调整分类 -->
            <div class="manual-adjust">
              <el-select v-model="selectedPrimaryCategory" placeholder="主分类">
                <el-option label="Desktop" value="desktop" />
                <el-option label="Mobile" value="mobile" />
                <el-option label="Avatar" value="avatar" />
              </el-select>
              <el-select v-model="selectedSecondaryCategory" placeholder="二级分类">
                <el-option
                  v-for="cat in secondaryCategories"
                  :key="cat"
                  :label="cat"
                  :value="cat"
                />
              </el-select>
            </div>
          </div>

          <!-- 图片描述 -->
          <div class="section">
            <h3>🎨 图片描述</h3>
            <p class="description">{{ analysisResult.description }}</p>
          </div>

          <!-- 标签 -->
          <div class="section">
            <h3>🏷️ 标签</h3>
            <div class="tags">
              <el-tag v-for="tag in analysisResult.tags" :key="tag" class="tag-item">
                {{ tag }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-else-if="error" class="error-state">
        <el-result icon="error" title="分析失败" :sub-title="error">
          <template #extra>
            <el-button type="primary" @click="retryAnalysis"> 重新分析 </el-button>
          </template>
        </el-result>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :disabled="!analysisResult" @click="confirmAnalysis">
          确认并应用
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import { analyzeImage } from '@/services/ai/classifier'

const props = defineProps({
  modelValue: Boolean,
  file: Object,
  aiToken: String
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const visible = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val)
})

const analyzing = ref(false)
const progress = ref(0)
const analysisResult = ref(null)
const error = ref(null)
const imagePreview = ref('')

const selectedFilename = ref('')
const customFilename = ref('')
const selectedPrimaryCategory = ref('')
const selectedSecondaryCategory = ref('')

// 你的实际分类结构
const CATEGORIES = {
  desktop: ['插画', '动漫', '风景', '萌宠', '人像', '影视', '游戏', 'IP形象'],
  mobile: ['插画', '创意', '动漫', '风景', '萌宠', '人像', '影视', 'IP形象'],
  avatar: ['表情包', '插画', '动漫', '萌宠', '人像', 'IP形象']
}

const secondaryCategories = computed(() => {
  return CATEGORIES[selectedPrimaryCategory.value] || []
})

// 置信度标签类型
const confidenceType = computed(() => {
  const confidence = analysisResult.value?.categorySuggestion.confidence || 0
  if (confidence >= 0.8) return 'success'
  if (confidence >= 0.6) return 'warning'
  return 'danger'
})

// 监听文件变化，自动分析
watch(
  () => props.file,
  async newFile => {
    if (newFile && visible.value) {
      await startAnalysis()
    }
  },
  { immediate: true }
)

// 开始分析
async function startAnalysis() {
  if (!props.file || !props.aiToken) return

  analyzing.value = true
  progress.value = 0
  error.value = null
  analysisResult.value = null

  // 生成图片预览
  imagePreview.value = URL.createObjectURL(props.file)

  try {
    // 模拟进度
    const progressInterval = setInterval(() => {
      if (progress.value < 90) {
        progress.value += 10
      }
    }, 300)

    // 调用 AI 分析
    const result = await analyzeImage(props.file, props.aiToken)

    clearInterval(progressInterval)
    progress.value = 100

    // 设置分析结果
    analysisResult.value = result
    selectedFilename.value = result.filenameSuggestions[0]
    selectedPrimaryCategory.value = result.categorySuggestion.primary
    selectedSecondaryCategory.value = result.categorySuggestion.secondary

    analyzing.value = false
  } catch (err) {
    analyzing.value = false
    error.value = err.message || 'AI 分析失败，请重试'
  }
}

// 重新分析
function retryAnalysis() {
  startAnalysis()
}

// 确认分析结果
function confirmAnalysis() {
  const finalFilename = customFilename.value || selectedFilename.value

  emit('confirm', {
    filename: finalFilename,
    primaryCategory: selectedPrimaryCategory.value,
    secondaryCategory: selectedSecondaryCategory.value,
    description: analysisResult.value.description,
    tags: analysisResult.value.tags
  })

  visible.value = false
}
</script>

<style lang="scss" scoped>
.ai-analysis-modal {
  min-height: 400px;

  .analyzing {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 0;

    .percentage-value {
      display: block;
      font-size: 28px;
      font-weight: bold;
      color: var(--el-color-primary);
    }

    .percentage-label {
      display: block;
      font-size: 14px;
      color: var(--el-text-color-secondary);
      margin-top: 4px;
    }

    .analyzing-text {
      margin-top: 24px;
      font-size: 16px;
      color: var(--el-text-color-regular);
    }
  }

  .analysis-result {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 24px;

    .image-preview {
      img {
        width: 100%;
        border-radius: 8px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
      }
    }

    .analysis-details {
      .section {
        margin-bottom: 24px;

        h3 {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--el-text-color-primary);
        }
      }

      .filename-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 12px;
      }

      .custom-input {
        margin-top: 8px;
      }

      .category-suggestion {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;

        .confidence-tag {
          margin-left: auto;
        }
      }

      .manual-adjust {
        display: flex;
        gap: 12px;
      }

      .description {
        padding: 12px;
        background: var(--el-fill-color-light);
        border-radius: 6px;
        line-height: 1.6;
        color: var(--el-text-color-regular);
      }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
    }
  }

  .error-state {
    padding: 40px 0;
  }
}
</style>
