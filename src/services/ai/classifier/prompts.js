/**
 * 分类服务专用提示词
 * 独立于 AI 助手的提示词配置
 */

import { CATEGORIES } from '@/config/categories'
import { getThirdLevelCategories } from '@/config/subcategories'
import { getUploadCategoryTree } from '@/services/upload/category-directory'

/**
 * 提示词模板配置
 */
export const PROMPT_TEMPLATES = {
  default: {
    id: 'default',
    name: '分类 + 文件名',
    description: '同时生成分类和文件名建议',
    builtin: true,
    variables: ['primaryCategory', 'secondaryList', 'thirdHints'],
    template: `分析这张图片，返回JSON格式的分类结果。

主分类：{{primaryCategory}}

可选的二级分类：{{secondaryList}}

三级分类选项：
{{thirdHints}}

规则：
1. 二级分类：从上面列表中选择最匹配的
2. 三级分类：优先选择具体风格，避免选"通用"
3. 文件名：**中文长命名**（8-15个汉字），结构：修饰形容词 + 主体 + 场景或动作 + .jpg
   - ❌拒绝太短（如"女孩.jpg"）
   - ✅示例：阳光下奔跑的治愈系柴犬.jpg、身穿黑色长裙的卷发港风少女.jpg
4. 关键词：3-5个中文词
5. 描述：20-40字优美中文描述

返回JSON（不要其他内容）：
{
  "secondary": "二级分类名称",
  "third": "三级分类名称",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "filename": "修饰形容词+主体+场景或动作.jpg",
  "description": "20-40字优美描述"
}`
  },

  filenameOnly: {
    id: 'filenameOnly',
    name: '仅文件名',
    description: '只生成文件名建议，不分类',
    builtin: true,
    variables: [],
    template: `分析这张图片，生成中文文件名。

规则：
1. 文件名：**中文长命名**（8-15个汉字），结构：修饰形容词 + 主体 + 场景或动作 + .jpg
   - ❌拒绝太短（如"女孩.jpg"）
   - ✅示例：阳光下奔跑的治愈系柴犬.jpg、身穿黑色长裙的卷发港风少女.jpg、赛博朋克风格的都市霓虹夜景.jpg
2. 关键词：3-5个中文词
3. 描述：20-40字优美中文描述

返回JSON（不要其他内容）：
{
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "filename": "修饰形容词+主体+场景或动作.jpg",
  "description": "20-40字优美描述"
}`
  },

  custom: {
    id: 'custom',
    name: '自定义',
    description: '使用自定义提示词',
    builtin: false,
    variables: [],
    template: ''
  }
}

/**
 * 系列专用的提示词模板
 * 每个系列有不同的分类逻辑和判定规则
 */
export const SERIES_TEMPLATES = {
  // Cloudflare AI 专用模板（Markdown 友好）
  cloudflare_desktop: `你是一位资深的视觉美学专家和壁纸分类大师。请用 **Markdown 格式** 详细分析这张图片。

## 📋 分类体系

**主分类**：{{primaryCategory}}

**二级分类选项**：{{secondaryList}}

**三级分类选项**：
{{thirdHints}}

---

## 🎯 分析任务

请按照以下格式输出分析结果（使用 Markdown 格式，支持换行和格式化）：

### 1️⃣ 分类结果

**二级分类**：[从上面列表中选择]

**三级分类**：[从上面列表中选择，优先选择具体风格]

**匹配度**：[完美匹配 / 近似匹配]

---

### 2️⃣ 分类逻辑

详细说明你的分类依据，包括：
- 识别到的主要元素
- 风格特征分析
- 为什么选择这个分类

---

### 3️⃣ 文件名建议（重点）

请根据画面中的**颜色、衣着、动作、光影**生成 3 个长文件名（8-15 个汉字）。

**严格要求**：
1. **必须包含具体的视觉形容词**（如：绿底、白色毛衣、仰望、侧颜、微光）。
2. **禁止**使用短名称（如"女孩.jpg"、"清新壁纸.jpg"）。
3. **禁止**重复同一个句式。

**参考范例**（请模仿这种长度和细节）：
- ✅ 错误示范：女孩侧面.jpg
- ✅ 正确示范：绿幕背景下的白色毛衣侧颜少女.jpg
- ✅ 正确示范：清新治愈系仰望天空的女孩.jpg

**请生成**：
1. **[文件名1].jpg**
2. **[文件名2].jpg**
3. **[文件名3].jpg**

---

### 4️⃣ 关键词

提供 3-5 个精准的中文关键词（必须包含画面中的核心物体）：

- 关键词1
- 关键词2
- 关键词3
- 关键词4
- 关键词5

---

### 5️⃣ 诗意标题

创作一个 8-15 字的诗意标题，要求：
- 避免直白描述，要富有想象力
- 结合画面的光影和情绪

**标题**：[你的创作]

---

### 6️⃣ 详细描述

用 30-60 字详细描述这张图片，**禁止重复**前面的句子：
- 重点描述：人物的衣着材质（如毛衣）、背景颜色（如绿色）、发型和神态。
- 尤其是光影是如何打在人物身上的。

---

### 7️⃣ 新分类建议（可选）

如果这张图片属于现有分类中缺失的知名 IP、明星或特定风格，请提出建议，否则写"无"。

**建议分类**：[二级分类]/[三级分类]

**理由**：[理由]`,

  desktop: `你是一位资深的视觉美学专家和壁纸分类大师。请分析图片，完成分类归档与元数据生成。

## 1. 现有分类体系 (System DB)

**主分类**：{{primaryCategory}}

**二级分类 (Secondary)**：
{{secondaryList}}

**三级分类 (Third)**：
{{thirdHints}}

## 2. 🧠 核心判定逻辑 (优先级由高到低)

请严格按照以下**决策树**进行判断，一旦命中上层规则，即停止向下匹配：

### A. 人像分类决策树 (Portrait Logic)

1. **特定明星**：
   - 如果识别出具体明星，并且现有目录中已有对应子类，优先归入对应分类。

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
   - 认出具体角色或作品，且现有目录中已有对应子类时，必须优先归入对应 IP 子类。

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
  - 示例：归类选 \`动漫/二次元\`，提案写 \`动漫/[具体作品名]\`。

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
}`,

  // Cloudflare AI 专用模板 - Mobile（Markdown 友好）
  cloudflare_mobile: `你是一位资深的视觉美学专家和壁纸分类大师。请用 **Markdown 格式** 详细分析这张手机壁纸。

## 📋 分类体系

**主分类**：{{primaryCategory}}

**二级分类选项**：{{secondaryList}}

**三级分类选项**：
{{thirdHints}}

---

## 🎯 分析任务

请按照以下格式输出分析结果（使用 Markdown 格式，支持换行和格式化）：

### 1️⃣ 分类结果

**二级分类**：[从上面列表中选择]

**三级分类**：[从上面列表中选择，优先选择具体风格]

**匹配度**：[完美匹配 / 近似匹配]

---

### 2️⃣ 分类逻辑

详细说明你的分类依据，包括：
- 识别到的主要元素
- 风格特征分析
- 为什么选择这个分类

---

### 3️⃣ 文件名建议（重点）

请根据画面中的**颜色、衣着、动作、光影**生成 3 个长文件名（8-15 个汉字）。

**严格要求**：
1. **必须包含具体的视觉形容词**（如：绿底、白色毛衣、仰望、侧颜、微光）。
2. **禁止**使用短名称（如"女孩.jpg"、"清新壁纸.jpg"）。
3. **禁止**重复同一个句式。

**参考范例**（请模仿这种长度和细节）：
- ✅ 错误示范：女孩侧面.jpg
- ✅ 正确示范：绿幕背景下的白色毛衣侧颜少女.jpg
- ✅ 正确示范：清新治愈系仰望天空的女孩.jpg

**请生成**：
1. **[文件名1].jpg**
2. **[文件名2].jpg**
3. **[文件名3].jpg**

---

### 4️⃣ 关键词

提供 3-5 个精准的中文关键词（必须包含画面中的核心物体）：

- 关键词1
- 关键词2
- 关键词3
- 关键词4
- 关键词5

---

### 5️⃣ 诗意标题

创作一个 8-15 字的诗意标题，要求：
- 避免直白描述，要富有想象力
- 结合画面的光影和情绪

**标题**：[你的创作]

---

### 6️⃣ 详细描述

用 30-60 字详细描述这张图片，**禁止重复**前面的句子：
- 重点描述：人物的衣着材质（如毛衣）、背景颜色（如绿色）、发型和神态。
- 尤其是光影是如何打在人物身上的。

---

### 7️⃣ 新分类建议（可选）

如果这张图片属于现有分类中缺失的知名 IP、明星或特定风格，请提出建议，否则写"无"。

**建议分类**：[二级分类]/[三级分类]

**理由**：[理由]`,

  mobile: `你是一位资深的视觉美学专家和壁纸分类大师。请分析图片，完成分类归档与元数据生成。

## 1. 现有分类体系 (System DB)

**主分类**：{{primaryCategory}}

**二级分类 (Secondary)**：
{{secondaryList}}

**三级分类 (Third)**：
{{thirdHints}}

## 2. 🧠 核心判定逻辑 (优先级由高到低)

请严格按照以下**决策树**进行判断，一旦命中上层规则，即停止向下匹配：

### A. 人像分类决策树 (Portrait Logic)

1. **特定明星/古装**：
   - 如果识别出具体明星，或明确属于现有目录中的细分类风格，优先归入对应分类。

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
   - 认出具体角色，且现有目录中已有对应子类时，必须优先归入对应 IP 子类。

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
  - 如果图片是**现有库中缺失**的知名 IP、明星或特定风格。
  - 请在 \`new_category_proposal\` 中填写建议。
  - 示例：归类选 \`动漫/二次元\`，提案写 \`动漫/[具体作品名]\`。

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
}`,

  // Cloudflare AI 专用模板 - Avatar（Markdown 友好）
  cloudflare_avatar: `你是一位资深的视觉美学专家和头像分类大师。请用 **Markdown 格式** 详细分析这张头像图片。

## 📋 分类体系

**主分类**：{{primaryCategory}}

**二级分类选项**：
{{secondaryList}}

**三级分类选项**：
{{thirdHints}}

---

## 🎯 分析任务

### 1️⃣ 分类结果

**二级分类**：[从上面列表中选择]

**三级分类**：[从上面列表中选择]

**匹配度**：[完美匹配 / 近似匹配]

---

### 2️⃣ 头像特征分析

**类型识别**：
- 是否为特定 IP 形象？[如 Hello Kitty、乌萨奇等]
- 是否为动漫角色？[如现有目录中的具体动漫角色或作品子类]
- 是否为人像？[卡通简笔画、氛围感、甜妹等]

**风格特点**：
[详细描述风格特征，可以多行]

**分类依据**：
[说明为什么选择这个分类]

---

### 3️⃣ 文件名建议

提供 2-3 个中文文件名（8-15 个汉字，**不要包含"头像"二字**）：

1. **[具体描述+风格特征].jpg**
2. **[另一个角度的描述].jpg**
3. **[第三个选择].jpg**

示例：
- ✅ 可爱粉色系凯蒂猫卡通形象.jpg
- ✅ 治愈系柴犬阳光下奔跑.jpg
- ❌ 可爱头像.jpg（太简单）

---

### 4️⃣ 关键词

- 关键词1
- 关键词2
- 关键词3
- 关键词4

---

### 5️⃣ 标题

**标题**：[8-15 字的标题，可以简洁活泼]

---

### 6️⃣ 详细描述

[30-60 字的详细描述]

---

### 7️⃣ 新分类建议（可选）

如果是现有分类中缺失的知名 IP 或角色：

**建议分类**：[二级]/[三级]

**理由**：[说明理由]`,

  avatar: `你是一位资深的视觉美学专家和壁纸分类大师。请分析图片，完成分类归档与元数据生成。

## 1. 现有分类体系 (System DB)

**主分类**：{{primaryCategory}}

**二级分类 (Secondary)**：
{{secondaryList}}

**三级分类 (Third)**：
{{thirdHints}}

## 2. 🧠 核心判定逻辑 (优先级由高到低)

请严格按照以下**决策树**进行判断，一旦命中上层规则，即停止向下匹配：

### A. IP形象与动漫决策树

1. **特定 IP 形象**：
   - 认出具体IP角色（如Hello Kitty、乌萨奇、水豚噜噜），必须归入对应 IP 子类。

2. **动漫角色**：
   - 认出具体动漫角色，且现有目录中已有对应子类时，归入对应动漫子类。
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

/**
 * 替换模板中的变量
 * @param {string} template - 模板字符串
 * @param {Object} variables - 变量对象
 * @returns {string} 替换后的字符串
 */
export function replaceVariables(template, variables) {
  let result = template

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(regex, value)
  })

  return result
}

/**
 * 构建变量
 * @param {string} primaryCategory - 主分类
 * @returns {Object} 变量对象
 */
export function buildVariables(primaryCategory, categoryTree = null) {
  const dynamicSeries = categoryTree?.[primaryCategory]
  const secondaryCategories =
    dynamicSeries?.secondary?.length > 0
      ? dynamicSeries.secondary.map(value => ({ value }))
      : CATEGORIES[primaryCategory]?.subcategories || []
  const secondaryList = secondaryCategories.map(cat => cat.value).join('、')

  let thirdHints = ''
  secondaryCategories.forEach(cat => {
    const thirdList =
      dynamicSeries?.third?.[cat.value]?.length > 0
        ? dynamicSeries.third[cat.value]
        : getThirdLevelCategories(primaryCategory, cat.value)
    thirdHints += `• ${cat.value}：${thirdList.join('、')}\n`
  })

  return {
    primaryCategory,
    secondaryList,
    thirdHints: thirdHints.trim()
  }
}

/**
 * 构建分类提示词
 * @param {string} templateId - 模板 ID
 * @param {string} primaryCategory - 主分类（系列名）
 * @param {string} customPrompt - 自定义提示词（可选）
 * @param {string} provider - AI Provider（可选，用于选择专用模板）
 * @returns {string} 构建的提示词
 */
export function buildPrompt(
  templateId,
  primaryCategory,
  customPrompt = '',
  provider = null,
  categoryTree = null
) {
  if (templateId === 'custom') {
    return customPrompt
  }

  // 对于 default 模板，使用系列专用模板
  if (templateId === 'default') {
    // 如果是 Cloudflare，优先使用 Cloudflare 专用模板
    if (provider === 'cloudflare') {
      const cloudflareTemplate = SERIES_TEMPLATES[`cloudflare_${primaryCategory}`]
      if (cloudflareTemplate) {
        const variables = buildVariables(primaryCategory, categoryTree)
        return replaceVariables(cloudflareTemplate, variables)
      }
    }

    // 使用标准系列模板
    const specialTemplate = SERIES_TEMPLATES[primaryCategory]
    if (specialTemplate) {
      const variables = buildVariables(primaryCategory, categoryTree)
      return replaceVariables(specialTemplate, variables)
    }
  }

  // 使用通用模板
  const template = PROMPT_TEMPLATES[templateId]
  if (!template) {
    throw new Error(`未找到模板: ${templateId}`)
  }

  if (!template.variables || template.variables.length === 0) {
    return template.template
  }

  const variables = buildVariables(primaryCategory, categoryTree)
  return replaceVariables(template.template, variables)
}

export async function buildPromptWithLatestCategories(
  templateId,
  primaryCategory,
  customPrompt = '',
  provider = null,
  options = {}
) {
  const categoryTree = await getUploadCategoryTree(options)
  return buildPrompt(templateId, primaryCategory, customPrompt, provider, categoryTree)
}

/**
 * 验证提示词
 * @param {string} prompt - 提示词
 * @returns {boolean} 是否有效
 */
export function validatePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return false
  }

  if (prompt.trim().length < 10) {
    return false
  }

  return true
}

/**
 * 获取模板列表
 * @returns {Array} 模板列表
 */
export function getTemplateList() {
  return Object.values(PROMPT_TEMPLATES)
}

/**
 * 根据 ID 获取模板
 * @param {string} templateId - 模板 ID
 * @returns {Object|null} 模板对象
 */
export function getTemplateById(templateId) {
  return PROMPT_TEMPLATES[templateId] || null
}

/**
 * 预览提示词
 * @param {string} templateId - 模板 ID
 * @param {string} primaryCategory - 主分类
 * @param {string} customPrompt - 自定义提示词
 * @returns {Object} 预览结果
 */
export function previewPrompt(templateId, primaryCategory, customPrompt = '') {
  try {
    const prompt = buildPrompt(templateId, primaryCategory, customPrompt)
    const isValid = validatePrompt(prompt)

    return {
      success: true,
      prompt,
      isValid,
      length: prompt.length,
      lines: prompt.split('\n').length
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      prompt: '',
      isValid: false,
      length: 0,
      lines: 0
    }
  }
}
