<template>
  <div class="doubao-test-view">
    <div class="test-container">
      <h1 class="title">🤖 AI 图片分类测试</h1>

      <!-- AI 模型选择 -->
      <el-card class="compact-card" shadow="hover">
        <template #header>⚙️ ModelScope AI 配置</template>
        <el-form label-width="80px" size="small">
          <el-form-item label="AI 模型">
            <el-select v-model="config.model" placeholder="选择模型" style="width: 100%">
              <el-option label="Qwen3-VL-8B-Instruct (推荐)" value="Qwen/Qwen3-VL-8B-Instruct" />
              <el-option
                label="Qwen3-VL-235B-A22B-Instruct (最强)"
                value="Qwen/Qwen3-VL-235B-A22B-Instruct"
              />
              <el-option label="Qwen3-VL-8B-Thinking (推理)" value="Qwen/Qwen3-VL-8B-Thinking" />
              <el-option label="QVQ-72B-Preview (视觉问答)" value="Qwen/QVQ-72B-Preview" />
              <el-option
                label="InternVL3.5-241B-A28B (备选)"
                value="OpenGVLab/InternVL3_5-241B-A28B"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 主分类选择 -->
      <el-card class="compact-card" shadow="hover">
        <template #header>📂 壁纸类型</template>
        <el-radio-group v-model="primaryCategory" size="default">
          <el-radio-button value="desktop">🖥️ Desktop</el-radio-button>
          <el-radio-button value="mobile">📱 Mobile</el-radio-button>
          <el-radio-button value="avatar">👤 Avatar</el-radio-button>
        </el-radio-group>
      </el-card>

      <!-- 上传图片 -->
      <el-card class="compact-card" shadow="hover">
        <template #header>📤 上传图片</template>

        <el-upload
          drag
          :auto-upload="false"
          :limit="1"
          accept="image/*"
          :on-change="handleFileChange"
        >
          <el-icon class="upload-icon"><UploadFilled /></el-icon>
          <div class="upload-text">拖拽图片或点击选择</div>
        </el-upload>

        <div v-if="selectedFile" class="file-info">
          <el-tag type="success">{{ selectedFile.name }}</el-tag>
          <el-tag type="primary">{{ primaryCategory }}</el-tag>
          <el-button
            type="primary"
            :loading="analyzing"
            :disabled="!hasValidConfig"
            @click="startAnalysis"
          >
            {{ analyzing ? '分析中...' : '🚀 开始分析' }}
          </el-button>
        </div>
      </el-card>

      <!-- 分析进度 -->
      <el-card v-if="analyzing" class="compact-card" shadow="hover">
        <div class="progress-content">
          <el-progress type="circle" :percentage="progress" :width="80" />
          <span class="progress-text">分析中...</span>
        </div>
      </el-card>

      <!-- 分析结果 -->
      <el-card v-if="result" class="compact-card" shadow="hover">
        <template #header>
          <div class="result-header">
            <span>✨ 分析结果</span>
            <el-tag :type="result.success ? 'success' : 'danger'" size="small">
              {{ result.success ? '成功' : '失败' }}
            </el-tag>
          </div>
        </template>

        <div v-if="result.success" class="result-content">
          <!-- 图片预览 -->
          <div v-if="imagePreview" class="result-section">
            <h3>�️ 原图预览</h3>
            <div class="image-preview">
              <img :src="imagePreview" alt="上传的图片" />
            </div>
          </div>

          <!-- 分类结果 -->
          <div class="result-section">
            <h3>📁 分类</h3>
            <div class="category-tags">
              <el-tag type="primary" size="small">{{ result.data.primary }}</el-tag>
              <span class="arrow">›</span>
              <el-tag type="success" size="small">{{ result.data.secondary }}</el-tag>
              <span class="arrow">›</span>
              <el-tag type="warning" size="small">{{ result.data.third }}</el-tag>
            </div>
          </div>

          <!-- 文件名建议 -->
          <div class="result-section">
            <h3>📝 文件名</h3>
            <div class="filename-list">
              <el-tag
                v-for="(name, index) in result.data.filenameSuggestions"
                :key="index"
                size="small"
                class="filename-tag"
              >
                {{ name }}
              </el-tag>
            </div>
          </div>

          <!-- 描述和关键词 -->
          <div class="result-section">
            <h3>💬 描述</h3>
            <p class="description">{{ result.data.description }}</p>
          </div>

          <div class="result-section">
            <h3>🏷️ 关键词</h3>
            <div class="keywords">
              <el-tag v-for="kw in result.data.keywords" :key="kw" type="info" size="small">{{
                kw
              }}</el-tag>
            </div>
          </div>

          <!-- 推理逻辑 -->
          <div v-if="result.data.reasoning" class="result-section">
            <h3>🧠 推理逻辑</h3>
            <p class="description">{{ result.data.reasoning }}</p>
          </div>

          <!-- 新分类提案 -->
          <div
            v-if="
              result.data.newCategoryProposal && result.data.newCategoryProposal.suggested_third
            "
            class="result-section"
          >
            <h3>💡 新分类建议</h3>
            <div class="proposal">
              <el-tag type="warning" size="small">
                {{ result.data.newCategoryProposal.suggested_secondary || '' }} /
                {{ result.data.newCategoryProposal.suggested_third }}
              </el-tag>
              <p class="proposal-reason">{{ result.data.newCategoryProposal.reason }}</p>
            </div>
          </div>

          <!-- 原始响应 -->
          <el-collapse style="margin-top: 16px">
            <el-collapse-item title="查看原始 JSON" name="raw">
              <pre class="raw-json">{{ JSON.stringify(result.raw, null, 2) }}</pre>
            </el-collapse-item>
          </el-collapse>
        </div>

        <el-alert v-else type="error" :title="result.error" :closable="false" show-icon />
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'

const config = ref({
  apiKey: 'ms-81e49e5f-1ba2-4a1f-943f-c89489f8b7b4',
  model: 'Qwen/Qwen3-VL-8B-Instruct'
})

const primaryCategory = ref('desktop')
const selectedFile = ref(null)
const imagePreview = ref(null) // 添加图片预览URL
const analyzing = ref(false)
const progress = ref(0)
const result = ref(null)

// 检查是否有有效配置
const hasValidConfig = computed(() => {
  return !!config.value.apiKey && !!config.value.model
})

const CATEGORIES = {
  desktop: {
    subcategories: ['插画', '动漫', '风景', '萌宠', '人像', '影视', '游戏', '政治', 'IP形象'],
    thirdLevel: {
      插画: ['场景', '创意', '国风', '卡通', '通用', '文字'],
      动漫: [
        '二次元',
        '仙逆',
        '刀剑神域',
        '初音未来',
        '剑来',
        '名侦探柯南',
        '哆啦A梦',
        '喜洋洋与灰太狼',
        '完美世界',
        '小埋',
        '斗破苍穹',
        '新世纪福音战士',
        '春物雪乃',
        '猫和老鼠',
        '百炼成神',
        '神奇宝贝',
        '紫罗兰永恒花园',
        '罪恶王冠',
        '蕾姆',
        '蜡笔小新',
        '进击的巨人',
        '间谍过家家',
        '鬼灭之刃'
      ],
      风景: ['城市', '天空', '建筑', '日落', '星空', '海滨', '湖泊', '花卉', '雪山'],
      萌宠: ['狗狗', '猫咪', '兔兔'],
      人像: ['氛围感', '国风', '魅力', '明星', '清新', '张凌赫'],
      影视: ['海绵宝宝', '疯狂动物城'],
      游戏: ['原神', '崩坏', '艾尔登法环', '英雄联盟', '通用'],
      政治: ['通用'],
      IP形象: ['乌萨奇', '凯蒂猫', '水豚噜噜', '粉红兔', '线条小狗', '通用']
    }
  },
  mobile: {
    subcategories: ['插画', '创意', '动漫', '风景', '萌宠', '人像', '影视', 'IP形象'],
    thirdLevel: {
      插画: ['创意', '国风', '少女与猫', '风景'],
      创意: ['抽象', '文字', '爱国主题'],
      动漫: [
        '二次元',
        '你的名字',
        '初音未来',
        '名侦探柯南',
        '夏目友人帐',
        '海贼王',
        '蜡笔小新',
        '通用'
      ],
      风景: ['冬日雪景', '建筑', '星空', '森林', '海滨', '花卉', '雪山'],
      萌宠: ['狗狗', '猫咪'],
      人像: [
        '古装',
        '张凌赫',
        '日系',
        '明星',
        '易烊千玺',
        '氛围感',
        '清新',
        '王楚然',
        '迪丽热巴',
        '魅力'
      ],
      影视: ['柯南', '海绵宝宝', '漫威', '猫和老鼠', '疯狂动物城'],
      IP形象: ['乌萨奇', '卡通角色', '小八', '水豚噜噜', '粉红兔']
    }
  },
  avatar: {
    subcategories: ['表情包', '插画', '动漫', '萌宠', '人像', 'IP形象'],
    thirdLevel: {
      表情包: ['搞怪'],
      插画: ['二次元', '创意'],
      动漫: [
        '哆啦A梦',
        '喜羊羊与灰太狼',
        '天线宝宝',
        '日漫',
        '樱桃小丸子',
        '海绵宝宝',
        '海贼王',
        '猫和老鼠',
        '神奇宝贝',
        '蜡笔小新',
        '通用'
      ],
      萌宠: ['狗狗', '猫咪'],
      人像: ['卡通简笔画', '氛围感', '甜妹', '背影'],
      IP形象: ['Hello Kitty', '乌萨奇', '小八', '小熊', '库洛米', '水豚噜噜', '牛牛黎深&噜噜']
    }
  }
}

function loadConfig() {
  const saved = localStorage.getItem('modelscope_config')
  if (saved) {
    config.value = JSON.parse(saved)
    ElMessage.success('配置已加载')
  }
}

function handleFileChange(file) {
  selectedFile.value = file
  result.value = null

  // 生成图片预览URL
  const fileObj = file.raw || file
  if (fileObj) {
    imagePreview.value = URL.createObjectURL(fileObj)
  }
}

async function compressImage(file) {
  return new Promise((resolve, reject) => {
    // 检查文件对象
    const fileObj = file.raw || file
    if (!fileObj || !fileObj.type || !fileObj.type.startsWith('image/')) {
      reject(new Error('请上传图片文件'))
      return
    }

    const reader = new FileReader()
    reader.onload = e => {
      // eslint-disable-next-line no-undef
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        let width = img.width
        let height = img.height
        const maxSize = 1024

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize
            width = maxSize
          } else {
            width = (width / height) * maxSize
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)

        // 返回纯Base64字符串（去掉data:image/jpeg;base64,前缀）
        const dataURL = canvas.toDataURL('image/jpeg', 0.9)
        const base64 = dataURL.split(',')[1]
        resolve(base64)
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(fileObj)
  })
}

function buildPrompt() {
  const category = CATEGORIES[primaryCategory.value]
  const secondaryList = category.subcategories.join('、')

  let thirdHints = ''
  category.subcategories.forEach(sub => {
    const thirdList = category.thirdLevel[sub] || ['通用']
    thirdHints += `• ${sub}：${thirdList.join('、')}\n`
  })

  // 根据主分类选择对应的提示词模板
  if (primaryCategory.value === 'desktop') {
    return `你是一位资深的视觉美学专家和壁纸分类大师。请分析图片，完成分类归档与元数据生成。

## 1. 现有分类体系 (System DB)

**主分类**：${primaryCategory.value}

**二级分类 (Secondary)**：
${secondaryList}

**三级分类 (Third)**：
${thirdHints}

## 2. 🧠 核心判定逻辑 (优先级由高到低)

请严格按照以下**决策树**进行判断，一旦命中上层规则，即停止向下匹配：

### A. 人像分类决策树 (Portrait Logic)

1. **特定明星**：
   - 如果识别出具体明星（如张凌赫），优先归入对应分类。

2. **【魅力】(Glamour)**：
   - **定义**：强调身材曲线、成熟美、吸引力。
   - **特征**：丝袜、紧身衣、露背/露肩、姿态撩人、夜景霓虹、御姐风。
   - **判定**：只要包含丝袜或明显的身材展示，优先选此项。

3. **【国风】(Chinese Style)**：
   - **定义**：中国传统美学、古典韵味。
   - **特征**：汉服、旗袍、古建筑、水墨画风、传统配饰。

4. **【氛围感】(Atmosphere)**：
   - **特征**：不露脸（背影/遮挡/模糊）、重光影意境、看不清具体五官。

5. **【清新】(Fresh)**：
   - **定义**：明亮、治愈、氧气感。
   - **特征**：高明度、色彩鲜艳自然、笑容甜美、构图干净。

### B. 动漫与插画决策树 (Anime Logic)

1. **特定 IP**：
   - 认出具体角色或作品（如初音未来、鬼灭之刃、美少女战士），必须归入对应 IP 子类。

2. **【动漫】(Anime)**：
   - **特征**：典型的日式动画风格（赛璐璐涂色、大眼睛、动画感）。
   - **子类判断**：
     - 能识别具体作品 -> 动漫/[作品名]
     - 无法识别具体作品 -> 动漫/二次元
   - **注意**：只要是动画风格，就应该归入"动漫"类，而不是"通用"

3. **【插画】(Illustration)**：
   - **特征**：绘画感强（水彩、厚涂、手绘风格），非动画截图感。
   - **子类判断**：
     - 国风元素 -> 插画/国风
     - 卡通风格 -> 插画/卡通
     - 创意设计 -> 插画/创意
     - 场景为主 -> 插画/场景
   - **区别**：插画更偏向艺术创作，动漫更偏向动画风格

### C. 风景分类决策树 (Landscape Logic)

1. **具体场景优先**：
   - 雪山 -> 风景/雪山
   - 城市建筑 -> 风景/城市 或 风景/建筑
   - 星空银河 -> 风景/星空
   - 海边沙滩 -> 风景/海滨
   - 湖泊倒影 -> 风景/湖泊
   - 日落黄昏 -> 风景/日落

2. **通用**：
   - 只有在无法明确归类到具体场景时才选择"通用"。

## 3. 任务规则

### 任务一：归类与提案

- **必须**从现有列表中选择 \`secondary\` 和 \`third\`。
- **新分类提案 (Proposal)**：
  - 如果图片是**现有库中缺失**的知名IP、明星或特定风格。
  - 请在 \`new_category_proposal\` 中填写建议。
  - 示例：归类选 \`动漫/二次元\`，提案写 \`动漫/咒术回战\`。

### 任务二：文案生成

- **标题 (displayTitle)**:：
  - 8-15个汉字，高雅、富有诗意。
  - 即使是"魅力"类图片，标题也要唯美含蓄，禁止使用低俗词汇。

- **文件名 (filenames)**：
  - **提供两个不同的中文文件名**（8-15个汉字）。
  - 禁止英文命名
  - 侧重于**具体描述**，方便检索。
  - 结构：修饰形容词 + '主体' + '场景或动作' + '.jpg'。
  - ❌拒绝太短（如"女孩.jpg"）。
  - ✅示例：
    - '阳光下奔跑的治愈系柴犬.jpg'
    - '身穿黑色长裙的卷发港风少女.jpg'
    - '赛博朋克风格的都市霓虹夜景.jpg'

- **关键词 (keywords)**：
  - 3-5个精准中文词，包含风格定义词。

## 4. 输出格式 (JSON Only)

请严格输出纯 JSON 格式，不要包含 markdown 标记：

{
  "secondary": "从现有列表中选择",
  "third": "从现有列表中选择",
  "is_perfect_match": true/false,
  "new_category_proposal": {
    "suggested_secondary": "建议二级(无则null)",
    "suggested_third": "建议三级(如具体IP名)",
    "reason": "提案理由"
  },
  "displayTitle": "诗意中文标题",
  "filenames": ["阳光下奔跑的治愈系柴犬.jpg", "草地上欢快玩耍的小柴犬.jpg"],
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "description": "20-40字优美描述",
  "reasoning": "逻辑链说明。例如：'图片为雪山风景，山峰清晰可见，根据规则C1，判定为[风景/雪山]'"
}`
  } else if (primaryCategory.value === 'mobile') {
    return `你是一位资深的视觉美学专家和壁纸分类大师。请分析图片，完成分类归档与元数据生成。

## 1. 现有分类体系 (System DB)

**主分类**：${primaryCategory.value}

**二级分类 (Secondary)**：
${secondaryList}

**三级分类 (Third)**：
${thirdHints}

## 2. 🧠 核心判定逻辑 (优先级由高到低)

请严格按照以下**决策树**进行判断，一旦命中上层规则，即停止向下匹配：

### A. 人像分类决策树 (Portrait Logic)

1. **特定明星/古装**：
   - 如果识别出具体明星（如迪丽热巴）或明确的古装（汉服），优先归入对应分类。

2. **【魅力】(Glamour)**：
   - **定义**：强调身材曲线、成熟美、吸引力。
   - **特征**：丝袜（黑/白丝）、紧身衣、露背/露肩、姿态撩人、夜景霓虹、御姐风。
   - **判定**：只要包含丝袜或明显的身材展示，优先选此项，覆盖日系/清新。

3. **【日系】(Japanese Style)**：
   - **定义**：胶片摄影风格、情绪片。
   - **特征**：颗粒感、低对比度、偏青/蓝色调、JK制服(非性感类)、街道/自动贩卖机、抓拍感。

4. **【清新】(Fresh)**：
   - **定义**：明亮、治愈、氧气感。
   - **特征**：高明度（画面很亮）、色彩鲜艳自然、笑容甜美、背景通常是草地/蓝天/白墙、构图干净、给人"初恋感"。

5. **【氛围感】(Atmosphere)**：
   - **特征**：不露脸（背影/遮挡/模糊）、重光影意境、看不清具体五官。

### B. 动漫与插画决策树 (Anime Logic)

1. **特定 IP**：
   - 认出具体角色（如路飞、柯南、美少女战士），必须归入对应 IP 子类。

2. **【动漫】(Anime)**：
   - **特征**：典型的日式动画风格（赛璐璐涂色、大眼睛、动画感）。
   - **子类判断**：
     - 能识别具体作品 -> 动漫/[作品名]
     - 无法识别具体作品 -> 动漫/二次元
   - **注意**：只要是动画风格，就应该归入"动漫"类，而不是"通用"

3. **【插画】(Illustration)**：
   - **特征**：绘画感强（水彩、厚涂、手绘风格），非动画截图感。
   - **区别**：插画更偏向艺术创作，动漫更偏向动画风格

## 3. 任务规则

### 任务一：归类与提案

- **必须**从现有列表中选择 \`secondary\` 和 \`third\`。
- **新分类提案 (Proposal)**：
  - 如果图片是**现有库中缺失**的知名IP（如《咒术回战》）、明星或特定风格。
  - 请在 \`new_category_proposal\` 中填写建议。
  - 示例：归类选 \`动漫/二次元\`，提案写 \`动漫/咒术回战\`。

### 任务二：文案生成

- **标题 (displayTitle)**:：
  - 8-15个汉字，高雅、富有诗意。
  - 即使是"魅力"类图片，标题也要唯美含蓄（如"月光下的黑色曼陀罗"，禁止使用低俗词汇）。

- **文件名 (filenames)**：
  - **提供两个不同的中文文件名**（8-15个汉字）。
  - 禁止英文命名
  - 侧重于**具体描述**，方便检索。
  - 结构：修饰形容词 + '主体' + '场景或动作' + '.jpg'。
  - ❌拒绝太短（如"女孩.jpg"）。
  - ✅示例：
    - '阳光下奔跑的治愈系柴犬.jpg'
    - '身穿黑色长裙的卷发港风少女.jpg'
    - '赛博朋克风格的都市霓虹夜景.jpg'

- **关键词 (keywords)**：
  - 3-5个精准中文词，包含风格定义词（如：胶片感、黑丝、治愈系）。

## 4. 输出格式 (JSON Only)

请严格输出纯 JSON 格式，不要包含 markdown 标记：

{
  "secondary": "从现有列表中选择",
  "third": "从现有列表中选择",
  "is_perfect_match": true/false,
  "new_category_proposal": {
    "suggested_secondary": "建议二级(无则null)",
    "suggested_third": "建议三级(如具体IP名)",
    "reason": "提案理由"
  },
  "displayTitle": "诗意中文标题",
  "filenames": ["身穿黑色长裙的卷发港风少女.jpg", "夜色中优雅漫步的长发女孩.jpg"],
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "description": "20-40字优美描述",
  "reasoning": "逻辑链说明。例如：'检测到人物穿着JK制服但光线明亮笑容甜美，无胶片感，根据规则A4，判定为[清新]而非[日系]'"
}`
  } else {
    // avatar
    return `你是一位资深的视觉美学专家和壁纸分类大师。请分析图片，完成分类归档与元数据生成。

## 1. 现有分类体系 (System DB)

**主分类**：${primaryCategory.value}

**二级分类 (Secondary)**：
${secondaryList}

**三级分类 (Third)**：
${thirdHints}

## 2. 🧠 核心判定逻辑 (优先级由高到低)

请严格按照以下**决策树**进行判断，一旦命中上层规则，即停止向下匹配：

### A. IP形象与动漫决策树

1. **特定 IP 形象**：
   - 认出具体IP角色（如Hello Kitty、乌萨奇、水豚噜噜），必须归入对应 IP 子类。

2. **动漫角色**：
   - 认出具体动漫角色（如哆啦A梦、海贼王角色），归入对应动漫子类。
   - 如果是动漫风格但无法识别具体作品 -> 动漫/通用

### B. 人像分类决策树

1. **卡通简笔画**：
   - **特征**：线条简单、Q版、可爱风格、非写实。
   - 归类为：人像/卡通简笔画

2. **氛围感**：
   - **特征**：不露脸（背影/遮挡/模糊）、重光影意境。
   - 归类为：人像/氛围感

3. **甜妹**：
   - **特征**：甜美可爱、少女感、清新风格。
   - 归类为：人像/甜妹

4. **背影**：
   - **特征**：主要展示背影，看不到正面。
   - 归类为：人像/背影

### C. 萌宠与表情包决策树

1. **表情包**：
   - **特征**：搞怪表情、夸张动作、用于聊天表达情绪。
   - 归类为：表情包/搞怪

2. **萌宠**：
   - 真实的猫狗照片 -> 萌宠/猫咪 或 萌宠/狗狗

### D. 插画决策树

1. **二次元插画**：
   - **特征**：动漫风格的插画，但非特定IP。
   - 归类为：插画/二次元

2. **创意插画**：
   - **特征**：创意设计、抽象风格、艺术感强。
   - 归类为：插画/创意

## 3. 任务规则

### 任务一：归类与提案

- **必须**从现有列表中选择 \`secondary\` 和 \`third\`。
- **新分类提案 (Proposal)**：
  - 如果图片是**现有库中缺失**的知名IP或角色。
  - 请在 \`new_category_proposal\` 中填写建议。
  - 示例：归类选 \`IP形象/通用\`，提案写 \`IP形象/玲娜贝儿\`。

### 任务二：文案生成

- **标题 (displayTitle)**:：
  - 8-15个汉字，高雅、富有诗意。
  - 头像类图片标题可以更简洁活泼。

- **文件名 (filenames)**：
  - **提供两个不同的中文文件名**（8-15个汉字）。
  - 禁止英文命名，禁止包含"头像"二字
  - 侧重于**具体描述**，方便检索。
  - 结构：修饰形容词 + '主体' + '特征或风格' + '.jpg'。
  - ❌拒绝太短（如"女孩.jpg"）、拒绝包含"头像"（如"可爱头像.jpg"）。
  - ✅示例：
    - '可爱粉色系凯蒂猫卡通形象.jpg'
    - '甜美风格Hello Kitty萌系插画.jpg'
    - '治愈系柴犬阳光下奔跑.jpg'

- **关键词 (keywords)**：
  - 3-5个精准中文词，包含风格定义词。

## 4. 输出格式 (JSON Only)

请严格输出纯 JSON 格式，不要包含 markdown 标记：

{
  "secondary": "从现有列表中选择",
  "third": "从现有列表中选择",
  "is_perfect_match": true/false,
  "new_category_proposal": {
    "suggested_secondary": "建议二级(无则null)",
    "suggested_third": "建议三级(如具体IP名)",
    "reason": "提案理由"
  },
  "displayTitle": "诗意中文标题",
  "filenames": ["可爱粉色系凯蒂猫卡通形象.jpg", "甜美风格Hello Kitty萌系插画.jpg"],
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "description": "20-40字优美描述",
  "reasoning": "逻辑链说明。例如：'识别出Hello Kitty角色特征，根据规则A1，判定为[IP形象/Hello Kitty]'"
}`
  }
}

async function startAnalysis() {
  if (!selectedFile.value) {
    ElMessage.warning('请先选择图片')
    return
  }

  if (!config.value.apiKey) {
    ElMessage.error('未配置 API Key')
    return
  }

  analyzing.value = true
  progress.value = 0
  result.value = null

  const progressInterval = setInterval(() => {
    if (progress.value < 90) {
      progress.value += 10
    }
  }, 300)

  try {
    const imageBase64 = await compressImage(selectedFile.value)
    const prompt = buildPrompt()

    const response = await fetch('https://api-inference.modelscope.cn/v1/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.value.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.value.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageBase64
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ],
        max_tokens: 2048,
        temperature: 0.2, // 较低的随机性，确保分类准确且稳定
        top_p: 0.8 // 降低多样性，提高一致性
      })
    })

    clearInterval(progressInterval)
    progress.value = 100

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`API 请求失败: ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()

    // 解析 ModelScope 响应
    const textContent = data.content?.find(c => c.type === 'text')
    const aiText = textContent?.text || ''

    const jsonMatch = aiText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AI 返回的内容中没有找到 JSON')
    }

    const parsed = JSON.parse(jsonMatch[0])

    result.value = {
      success: true,
      data: {
        primary: primaryCategory.value,
        secondary: parsed.secondary || '通用',
        third: parsed.third || '通用',
        filenameSuggestions: parsed.filenames || [
          parsed.filename || parsed.displayTitle,
          `${parsed.secondary}-${parsed.keywords?.[0] || '图片'}`
        ],
        keywords: parsed.keywords || [],
        description: parsed.description || parsed.reasoning || '无描述',
        reasoning: parsed.reasoning,
        newCategoryProposal: parsed.new_category_proposal
      },
      raw: data
    }

    ElMessage.success('分析完成！')
  } catch (error) {
    clearInterval(progressInterval)
    result.value = {
      success: false,
      error: error.message
    }
    ElMessage.error(`分析失败: ${error.message}`)
  } finally {
    analyzing.value = false
  }
}

// 页面加载时自动加载配置（可选）
// loadConfig()
</script>

<style lang="scss" scoped>
.doubao-test-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.test-container {
  max-width: 900px;
  margin: 0 auto;
}

.title {
  text-align: center;
  font-size: 28px;
  font-weight: bold;
  color: white;
  margin-bottom: 20px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.compact-card {
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: none;
  border-radius: 12px;

  :deep(.el-card__header) {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-size: 15px;
    font-weight: 600;
    border-radius: 12px 12px 0 0;
    padding: 12px 16px;
  }

  :deep(.el-card__body) {
    padding: 16px;
  }
}

.upload-icon {
  font-size: 60px;
  color: #667eea;
  margin-bottom: 12px;
}

.upload-text {
  font-size: 14px;
  color: #666;
}

.file-info {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.progress-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px;

  .progress-text {
    font-size: 14px;
    color: #666;
  }
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.result-content {
  .result-section {
    margin-bottom: 16px;

    h3 {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    }
  }

  .category-tags {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;

    .arrow {
      font-size: 16px;
      color: #999;
    }
  }

  .image-preview {
    display: flex;
    justify-content: center;
    align-items: center;
    background: #f5f5f5;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;

    img {
      max-width: 100%;
      max-height: 400px;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
  }

  .filename-list {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .filename-tag {
      padding: 8px 12px;
      font-size: 13px;
    }
  }

  .description {
    font-size: 13px;
    line-height: 1.6;
    color: #666;
    background: #f5f5f5;
    padding: 10px;
    border-radius: 6px;
  }

  .keywords {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .proposal {
    .proposal-reason {
      margin-top: 8px;
      font-size: 13px;
      color: #666;
      background: #fff9e6;
      padding: 8px;
      border-radius: 4px;
    }
  }

  .raw-json {
    background: #f5f5f5;
    padding: 12px;
    border-radius: 6px;
    font-size: 11px;
    line-height: 1.5;
    overflow-x: auto;
  }
}
</style>
