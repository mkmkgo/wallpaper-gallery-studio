<template>
  <GradientBackground>
    <div class="login">
      <!-- 装饰元素 -->
      <div class="login__decor">
        <div class="login__decor-circle login__decor-circle--1"></div>
        <div class="login__decor-circle login__decor-circle--2"></div>
        <div class="login__decor-circle login__decor-circle--3"></div>
      </div>

      <div ref="cardRef" class="login__container">
        <!-- 左侧品牌区 -->
        <div class="login__brand">
          <div class="login__brand-content">
            <div class="login__brand-badge">
              <svg class="login__brand-badge-icon" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
                />
              </svg>
              <span>Powered by GitHub</span>
            </div>
            <h1 class="login__brand-title">
              <span class="login__brand-title-main">Wallpaper</span>
              <span class="login__brand-title-main">Gallery</span>
              <span class="login__brand-title-sub">· Studio</span>
            </h1>
            <p class="login__brand-desc">
              壁纸管理工作台<br />
              <span class="login__brand-desc-en">Upload · Organize · Automate</span>
            </p>
            <div class="login__brand-features">
              <div class="login__brand-feature">
                <span class="login__brand-feature-icon">🖼️</span>
                <span>高清壁纸上传</span>
              </div>
              <div class="login__brand-feature">
                <span class="login__brand-feature-icon">📁</span>
                <span>智能分类管理</span>
              </div>
              <div class="login__brand-feature">
                <span class="login__brand-feature-icon">⚡</span>
                <span>自动化工作流</span>
              </div>
            </div>
          </div>
          <div class="login__brand-footer">
            <a :href="repoUrl" target="_blank" class="login__brand-repo">
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <path
                  d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
                />
              </svg>
              <span>View on GitHub</span>
            </a>
          </div>
        </div>

        <!-- 右侧登录区 -->
        <div class="login__main">
          <!-- 已登录状态 -->
          <div v-if="authStore.isAuthenticated" class="login__user">
            <div class="login__user-welcome">
              <span class="login__user-welcome-text">Welcome back</span>
              <h2 class="login__user-name">{{ authStore.user?.name || authStore.user?.login }}</h2>
            </div>

            <el-avatar :size="64" :src="authStore.user?.avatar_url" class="login__user-avatar" />

            <!-- 权限信息卡片 -->
            <div
              class="login__permission-card"
              :class="
                authStore.permissionChecked
                  ? `login__permission-card--${authStore.permissionLevel}`
                  : 'login__permission-card--loading'
              "
            >
              <div v-if="!authStore.permissionChecked" class="login__permission-loading">
                <el-icon class="is-loading"><Loading /></el-icon>
                <span>正在检查权限...</span>
              </div>
              <template v-else>
                <div class="login__permission-header">
                  <span class="login__permission-icon">{{ permissionIcon }}</span>
                  <div class="login__permission-info">
                    <span class="login__permission-level">{{ permissionLabel }}</span>
                    <span class="login__permission-desc">{{ permissionDesc }}</span>
                  </div>
                </div>
                <div class="login__permission-repo">
                  <span class="login__permission-repo-label">目标仓库</span>
                  <a :href="repoUrl" target="_blank" class="login__permission-repo-link">
                    {{ configStore.config.owner }}/{{ configStore.config.repo }}
                  </a>
                </div>
              </template>
            </div>

            <!-- 权限不足警告 -->
            <Transition name="warning-fade">
              <div
                v-if="authStore.permissionChecked && !authStore.canUpload"
                class="login__permission-warning"
              >
                <p>⚠️ 您没有写入权限，无法上传文件</p>
                <p class="login__permission-warning-hint">请联系仓库管理员将您添加为协作者</p>
              </div>
            </Transition>

            <div class="login__actions">
              <button
                class="login__btn login__btn--primary"
                :disabled="!authStore.permissionChecked"
                @click="goToUpload"
              >
                <span v-if="!authStore.permissionChecked" class="login__btn-text"
                  >检查权限中...</span
                >
                <span v-else class="login__btn-text">进入工作台</span>
                <span v-if="authStore.permissionChecked" class="login__btn-icon">→</span>
              </button>
              <button class="login__btn login__btn--ghost" @click="handleLogout">退出登录</button>
            </div>
          </div>

          <!-- 未登录状态 -->
          <div v-else class="login__form">
            <div class="login__form-header">
              <h2 class="login__form-title">欢迎使用</h2>
              <p class="login__form-subtitle">登录以开始管理您的壁纸库</p>
            </div>

            <!-- GitHub OAuth 登录按钮 -->
            <button class="login__github-btn" :disabled="loading" @click="handleGitHubLogin">
              <svg class="login__github-icon" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
                />
              </svg>
              <span>{{ loading ? '连接中...' : '使用 GitHub 登录' }}</span>
            </button>

            <div class="login__divider">
              <span>或使用 Token</span>
            </div>

            <!-- Token 登录 -->
            <div class="login__token-section">
              <button class="login__token-toggle" @click="showTokenInput = !showTokenInput">
                <span>{{ showTokenInput ? '收起' : '展开 Token 登录' }}</span>
                <span
                  class="login__token-toggle-icon"
                  :class="{ 'login__token-toggle-icon--open': showTokenInput }"
                  >▼</span
                >
              </button>

              <Transition name="collapse">
                <div v-if="showTokenInput" class="login__token-form">
                  <div class="login__input-wrapper">
                    <el-input
                      v-model="tokenInput"
                      type="password"
                      placeholder="粘贴您的 Personal Access Token"
                      size="large"
                      show-password
                      class="login__input"
                    />
                  </div>

                  <button
                    class="login__btn login__btn--primary"
                    :disabled="!tokenInput.trim() || tokenLoading"
                    @click="handleTokenLogin"
                  >
                    <span class="login__btn-text">{{
                      tokenLoading ? '验证中...' : '验证并登录'
                    }}</span>
                  </button>

                  <a
                    class="login__create-token"
                    href="https://github.com/settings/tokens/new?scopes=repo&description=NuanXin%20Gallery"
                    target="_blank"
                  >
                    还没有 Token？点击创建 →
                  </a>
                </div>
              </Transition>
            </div>

            <p class="login__hint">
              <span class="login__hint-icon">🔒</span>
              需要仓库协作者权限才能上传
            </p>
          </div>
        </div>
      </div>
    </div>
  </GradientBackground>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import GradientBackground from '@/components/GradientBackground.vue'
import { useAuthStore } from '@/stores/auth'
import { useConfigStore } from '@/stores/config'
import { useAnimation } from '@/composables/useAnimation'
import { githubService } from '@/services/github'
import { getAuthUrl } from '@/config/oauth'

const router = useRouter()
const authStore = useAuthStore()
const configStore = useConfigStore()
const { fadeInScale } = useAnimation()

const cardRef = ref(null)
const loading = ref(false)
const tokenLoading = ref(false)
const tokenInput = ref('')
const showTokenInput = ref(false)

// 权限标签
const permissionLabel = computed(() => {
  const labels = {
    admin: '管理员',
    write: '协作者',
    read: '只读',
    none: '无权限'
  }
  return labels[authStore.permissionLevel] || '未知'
})

const permissionIcon = computed(() => {
  const icons = {
    admin: '👑',
    write: '✏️',
    read: '👁️',
    none: '🚫'
  }
  return icons[authStore.permissionLevel] || '❓'
})

const permissionDesc = computed(() => {
  const descs = {
    admin: '拥有完全管理权限',
    write: '可以上传和修改文件',
    read: '仅可查看，无法上传',
    none: '无法访问此仓库'
  }
  return descs[authStore.permissionLevel] || '权限未知'
})

// 仓库链接
const repoUrl = computed(() => {
  const { owner, repo } = configStore.config
  return `https://github.com/${owner}/${repo}`
})

// GitHub OAuth 登录
function handleGitHubLogin() {
  try {
    loading.value = true
    window.location.href = getAuthUrl()
  } catch (error) {
    loading.value = false
    ElMessage.error(error.message || 'OAuth 配置不完整，请先在设置页完成配置')
  }
}

// Token 登录
async function handleTokenLogin() {
  const token = tokenInput.value.trim()
  if (!token) return

  tokenLoading.value = true
  try {
    githubService.setToken(token)
    const userData = await githubService.getCurrentUser()

    authStore.setToken(token)
    authStore.setUser(userData)

    const { owner, repo } = configStore.config
    await authStore.checkPermission(owner, repo)

    ElMessage.success(`欢迎回来，${userData.name || userData.login}！`)
    tokenInput.value = ''
  } catch (error) {
    console.error('Token login failed:', error)
    ElMessage.error('Token 无效或已过期，请检查后重试')
    githubService.setToken(null)
  } finally {
    tokenLoading.value = false
  }
}

// 退出登录
async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '退出确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    authStore.logout()
    ElMessage.success('已退出登录')
  } catch {
    // 取消
  }
}

// 进入系统
function goToUpload() {
  router.push('/upload')
}

// 入场动画
onMounted(async () => {
  if (cardRef.value) {
    fadeInScale(cardRef.value, { duration: 0.8, scale: 0.95 })
  }

  if (authStore.token) {
    const valid = await authStore.validateToken()
    if (valid) {
      const { owner, repo } = configStore.config
      await authStore.checkPermission(owner, repo)
    }
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.login {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: $spacing-6;
  position: relative;
  overflow: hidden;

  // 装饰圆圈
  &__decor {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;

    &-circle {
      position: absolute;
      border-radius: 50%;
      opacity: 0.1;
      animation: float 20s ease-in-out infinite;

      &--1 {
        width: 600px;
        height: 600px;
        background: $primary-gradient;
        top: -200px;
        right: -100px;
        animation-delay: 0s;
      }

      &--2 {
        width: 400px;
        height: 400px;
        background: linear-gradient(135deg, #06b6d4, #8b5cf6);
        bottom: -100px;
        left: -100px;
        animation-delay: -5s;
      }

      &--3 {
        width: 300px;
        height: 300px;
        background: linear-gradient(135deg, #f59e0b, #ef4444);
        top: 50%;
        left: 50%;
        animation-delay: -10s;
      }
    }
  }

  &__container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
    max-width: 900px;
    min-height: 560px;
    background: $glass-bg;
    backdrop-filter: blur(24px);
    border: 1px solid $glass-border;
    border-radius: $radius-2xl;
    box-shadow:
      0 25px 50px -12px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.05) inset;
    overflow: hidden;
    position: relative;
    z-index: 1;
  }

  // 左侧品牌区
  &__brand {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: $spacing-8;
    background: linear-gradient(135deg, rgba($primary-start, 0.15), rgba($primary-end, 0.1));
    border-right: 1px solid rgba(255, 255, 255, 0.05);

    &-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    &-badge {
      display: inline-flex;
      align-items: center;
      gap: $spacing-2;
      padding: $spacing-2 $spacing-4;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 100px;
      font-size: $font-size-xs;
      color: $gray-400;
      width: fit-content;
      margin-bottom: $spacing-6;

      &-icon {
        width: 14px;
        height: 14px;
        opacity: 0.8;
      }
    }

    &-title {
      margin: 0 0 $spacing-4;

      &-main {
        display: block;
        font-size: 38px;
        font-weight: 700;
        background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.7) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        letter-spacing: -1px;
        line-height: 1.1;
      }

      &-sub {
        display: inline-block;
        font-size: 24px;
        font-weight: 400;
        color: $primary-start;
        margin-top: $spacing-2;
      }
    }

    &-desc {
      font-size: $font-size-base;
      color: $gray-300;
      line-height: 1.6;
      margin: 0 0 $spacing-8;

      &-en {
        font-size: $font-size-sm;
        color: $gray-500;
      }
    }

    &-features {
      display: flex;
      flex-direction: column;
      gap: $spacing-3;
    }

    &-feature {
      display: flex;
      align-items: center;
      gap: $spacing-3;
      font-size: $font-size-sm;
      color: $gray-400;

      &-icon {
        font-size: 20px;
      }
    }

    &-footer {
      font-size: $font-size-xs;
      color: $gray-600;
    }

    &-repo {
      display: inline-flex;
      align-items: center;
      gap: $spacing-2;
      color: $gray-500;
      text-decoration: none;
      transition: color 0.3s;

      &:hover {
        color: $white;
      }

      svg {
        opacity: 0.7;
      }
    }
  }

  // 右侧主区域
  &__main {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: $spacing-8;
  }

  // 已登录用户
  &__user {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $spacing-4;
    width: 100%;

    &-welcome {
      text-align: center;

      &-text {
        font-size: $font-size-xs;
        color: $gray-500;
        text-transform: uppercase;
        letter-spacing: 2px;
      }
    }

    &-name {
      font-size: $font-size-xl;
      font-weight: 600;
      color: $white;
      margin: $spacing-1 0 0;
    }

    &-avatar {
      border: 3px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
  }

  // 权限卡片
  &__permission-card {
    width: 100%;
    padding: $spacing-3;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: $radius-lg;
    transition: all 0.3s ease;

    &--loading {
      border-color: rgba(255, 255, 255, 0.15);
      background: rgba(255, 255, 255, 0.03);
    }
    &--admin {
      border-color: rgba($success, 0.3);
      background: rgba($success, 0.08);
    }
    &--write {
      border-color: rgba($primary-start, 0.3);
      background: rgba($primary-start, 0.08);
    }
    &--read {
      border-color: rgba($warning, 0.3);
      background: rgba($warning, 0.08);
    }
    &--none {
      border-color: rgba($danger, 0.3);
      background: rgba($danger, 0.08);
    }
  }

  &__permission-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-2;
    padding: $spacing-1;
    color: $gray-400;
    font-size: $font-size-sm;

    .is-loading {
      animation: spin 1s linear infinite;
    }
  }

  &__permission-header {
    display: flex;
    align-items: center;
    gap: $spacing-3;
    margin-bottom: $spacing-2;
    padding-bottom: $spacing-2;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  &__permission-icon {
    font-size: 20px;
  }

  &__permission-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  &__permission-level {
    font-size: $font-size-sm;
    font-weight: 600;
    color: $white;
  }

  &__permission-desc {
    font-size: $font-size-xs;
    color: $gray-400;
  }

  &__permission-repo {
    display: flex;
    justify-content: space-between;
    align-items: center;

    &-label {
      font-size: $font-size-xs;
      color: $gray-500;
    }

    &-link {
      font-size: $font-size-xs;
      color: $primary-start;
      text-decoration: none;
      font-family: monospace;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  &__permission-warning {
    width: 100%;
    padding: $spacing-2 $spacing-3;
    background: rgba($danger, 0.1);
    border: 1px solid rgba($danger, 0.3);
    border-radius: $radius-lg;
    text-align: center;

    p {
      margin: 0;
      color: $danger;
      font-size: $font-size-sm;
    }

    &-hint {
      color: $gray-400 !important;
      font-size: $font-size-xs !important;
      margin-top: $spacing-1 !important;
    }
  }

  // 操作按钮
  &__actions {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
    width: 100%;
  }

  &__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-2;
    width: 100%;
    height: 44px;
    border: none;
    border-radius: $radius-lg;
    font-size: $font-size-sm;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s $ease-out;

    &--primary {
      background: $primary-gradient;
      color: $white;
      box-shadow: 0 4px 20px rgba($primary-start, 0.3);

      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 30px rgba($primary-start, 0.4);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .login__btn-icon {
        transition: transform 0.3s;
      }

      &:hover:not(:disabled) .login__btn-icon {
        transform: translateX(4px);
      }
    }

    &--ghost {
      background: transparent;
      color: $gray-400;
      border: 1px solid rgba(255, 255, 255, 0.1);

      &:hover {
        background: rgba(255, 255, 255, 0.05);
        color: $white;
      }
    }
  }

  // 登录表单
  &__form {
    display: flex;
    flex-direction: column;
    gap: $spacing-5;
    width: 100%;

    &-header {
      text-align: center;
      margin-bottom: $spacing-2;
    }

    &-title {
      font-size: $font-size-2xl;
      font-weight: 600;
      color: $white;
      margin: 0 0 $spacing-2;
    }

    &-subtitle {
      font-size: $font-size-sm;
      color: $gray-300;
      margin: 0;
    }
  }

  // GitHub 按钮
  &__github-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-3;
    width: 100%;
    height: 52px;
    background: linear-gradient(135deg, #24292e 0%, #1a1e22 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: $radius-lg;
    color: $white;
    font-size: $font-size-base;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s $ease-out;

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #2f363d 0%, #24292e 100%);
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
    }

    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  }

  &__github-icon {
    width: 22px;
    height: 22px;
  }

  // 分隔线
  &__divider {
    display: flex;
    align-items: center;
    gap: $spacing-4;
    color: $gray-400;
    font-size: $font-size-xs;

    &::before,
    &::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent);
    }
  }

  // Token 区域
  &__token-section {
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
  }

  &__token-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-2;
    background: none;
    border: none;
    color: $gray-300;
    font-size: $font-size-sm;
    cursor: pointer;
    transition: color 0.3s;

    &:hover {
      color: $primary-start;
    }

    &-icon {
      font-size: 10px;
      transition: transform 0.3s;

      &--open {
        transform: rotate(180deg);
      }
    }
  }

  &__token-form {
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
    max-height: 200px;
  }

  &__input-wrapper {
    :deep(.el-input__wrapper) {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: $radius-lg;
      box-shadow: none;

      &:hover {
        border-color: rgba(255, 255, 255, 0.25);
      }

      &.is-focus {
        border-color: $primary-start;
        box-shadow: 0 0 0 3px rgba($primary-start, 0.1);
      }
    }

    :deep(.el-input__inner) {
      color: $white;

      &::placeholder {
        color: $gray-400;
      }
    }
  }

  &__create-token {
    font-size: $font-size-xs;
    color: $gray-300;
    text-align: center;
    text-decoration: none;
    transition: color 0.3s;

    &:hover {
      color: $primary-start;
    }
  }

  &__hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-2;
    color: $gray-300;
    font-size: $font-size-xs;
    margin: 0;

    &-icon {
      font-size: 14px;
    }
  }
}

// 动画
@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }
  25% {
    transform: translate(20px, -20px) rotate(5deg);
  }
  50% {
    transform: translate(-10px, 20px) rotate(-5deg);
  }
  75% {
    transform: translate(-20px, -10px) rotate(3deg);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// 折叠动画
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 200px;
}

// 警告淡入动画
.warning-fade-enter-active {
  transition: all 0.5s ease-out;
  transition-delay: 0.3s;
}

.warning-fade-leave-active {
  transition: all 0.3s ease-in;
}

.warning-fade-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.warning-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.warning-fade-enter-to,
.warning-fade-leave-from {
  opacity: 1;
  transform: translateY(0);
}

// 响应式
@media (max-width: 640px) {
  .login {
    padding: $spacing-4;

    &__container {
      grid-template-columns: 1fr;
      max-width: 400px;
      min-height: auto;
    }

    &__brand {
      display: none;
    }

    &__main {
      padding: $spacing-6;
    }
  }
}
</style>
