<script setup>
import { computed, ref } from 'vue'
import { analyzeDouyinVideo } from '../services/aiAnalyzer'

const categories = [
  '泛知识',
  '剧情搞笑',
  '美食探店',
  '本地生活',
  '电商种草',
  '美妆护肤',
  '穿搭时尚',
  '家居家装',
  '亲子育儿',
  '职场商业',
  '财经理财',
  '科技数码',
  '教育培训',
  '健康养生',
  '运动健身',
  '汽车出行',
  '旅行户外',
  '情感心理',
  '游戏动漫',
  '音乐舞蹈',
  '宠物萌宠',
  '三农乡村',
  '房产装修',
  '法律科普',
]
const progressSteps = ['读取链接', '整理公开信息', '调用 AI 模型', '生成评分', '输出优化建议']
const scoreLabels = {
  content: '内容质量',
  visual: '视觉表现',
  hook: '开头钩子',
  interaction: '互动潜力',
  growth: '增长潜力',
}

const douyinLink = ref('')
const category = ref('泛知识')
const commentScreenshots = ref([])
const isDraggingComments = ref(false)
const isAnalyzing = ref(false)
const activeStep = ref(0)
const report = ref(null)
const errorMessage = ref('')

const canStart = computed(() => douyinLink.value.trim().length > 0 && !isAnalyzing.value)

function isDouyinLink(value) {
  return /https?:\/\/[^\s]*(douyin\.com|iesdouyin\.com)/i.test(value)
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => resolve(reader.result))
    reader.addEventListener('error', () => reject(new Error('评论区截图读取失败')))
    reader.readAsDataURL(file)
  })
}

async function handleCommentScreenshots(event) {
  const files = Array.from(event.target.files || [])
  await addCommentScreenshots(files)

  event.target.value = ''
}

async function addCommentScreenshots(files) {
  const imageFiles = files.filter((file) => file.type.startsWith('image/'))

  const screenshots = await Promise.all(
    imageFiles.map(async (file) => {
      const dataUrl = await readFileAsDataUrl(file)

      return {
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        name: file.name,
        url: URL.createObjectURL(file),
        dataUrl,
      }
    }),
  )

  commentScreenshots.value = [
    ...commentScreenshots.value,
    ...screenshots,
  ].slice(0, 6)
}

async function handleCommentDrop(event) {
  isDraggingComments.value = false
  await addCommentScreenshots(Array.from(event.dataTransfer.files || []))
}

function removeCommentScreenshot(id) {
  const target = commentScreenshots.value.find((item) => item.id === id)

  if (target) {
    URL.revokeObjectURL(target.url)
  }

  commentScreenshots.value = commentScreenshots.value.filter((item) => item.id !== id)
}

async function runProgress() {
  activeStep.value = 0

  for (let index = 0; index < progressSteps.length - 1; index += 1) {
    activeStep.value = index
    await wait(450)
  }
}

async function startDiagnosis() {
  errorMessage.value = ''
  report.value = null

  const link = douyinLink.value.trim()

  if (!isDouyinLink(link)) {
    errorMessage.value = '请输入有效的抖音分享链接，支持 douyin.com 或 v.douyin.com。'
    return
  }

  isAnalyzing.value = true

  try {
    const progressPromise = runProgress()

    const nextReport = await analyzeDouyinVideo({
      douyinLink: link,
      category: category.value,
      commentScreenshots: commentScreenshots.value,
    })

    await progressPromise
    activeStep.value = progressSteps.length - 1
    report.value = nextReport
  } catch (error) {
    errorMessage.value = error?.message || '诊断失败，请检查 AI Key 或接口配置。'
  } finally {
    isAnalyzing.value = false
  }
}

function resetDiagnosis() {
  report.value = null
  errorMessage.value = ''
  activeStep.value = 0
}
</script>

<template>
  <main class="page-shell">
    <header class="top-bar">
      <div class="brand-mark">Dy</div>
      <div>
        <strong>抖音诊断</strong>
        <span>基于 AI 的短视频内容分析工具</span>
      </div>
    </header>

    <section v-if="!report" class="workspace">
      <article class="panel input-panel">
        <p class="section-tag">输入视频素材</p>
        <h1>粘贴抖音链接，生成视频诊断报告</h1>
        <p class="muted-text">复制抖音分享链接到这里，点击开始诊断后，页面会直接请求 AI 接口并返回评分、问题和优化方案。</p>

        <label class="field-label" for="douyin-link">抖音分享链接</label>
        <textarea
          id="douyin-link"
          v-model="douyinLink"
          placeholder="例如：https://v.douyin.com/xxxx/ 或完整分享文案"
          rows="6"
        />

        <div class="comment-upload-block">
          <div class="upload-copy">
            <strong>评论区截图</strong>
            <p>
              抖音评论区通常需要登录、动态加载，并且前端无法稳定读取评论数据。请上传热门评论截图，AI 会结合链接和截图一起分析用户反馈、争议点、共鸣点和改进方向。
            </p>
          </div>

          <label
            :class="['upload-box', { dragging: isDraggingComments }]"
            for="comment-screenshots"
            @dragenter.prevent="isDraggingComments = true"
            @dragover.prevent="isDraggingComments = true"
            @dragleave.prevent="isDraggingComments = false"
            @drop.prevent="handleCommentDrop"
          >
            <input
              id="comment-screenshots"
              accept="image/*"
              multiple
              type="file"
              @change="handleCommentScreenshots"
            />
            <span>上传评论区截图</span>
            <small>建议上传 1-6 张，优先包含热评和争议评论</small>
          </label>

          <div v-if="commentScreenshots.length" class="screenshot-list">
            <div v-for="item in commentScreenshots" :key="item.id" class="screenshot-item">
              <img :alt="item.name" :src="item.url" />
              <button type="button" @click="removeCommentScreenshot(item.id)">移除</button>
            </div>
          </div>
        </div>

        <p class="hint-text">粘贴链接后点击开始诊断，AI 会生成评分、问题定位和优化建议。</p>
      </article>

      <aside class="panel config-panel">
        <p class="section-tag">视频信息</p>
        <h2>选择内容类目</h2>
        <div class="category-list">
          <button
            v-for="item in categories"
            :key="item"
            :class="['category-pill', { active: item === category }]"
            type="button"
            @click="category = item"
          >
            {{ item }}
          </button>
        </div>

        <div v-if="isAnalyzing" class="progress-card">
          <div class="progress-line">
            <span :style="{ width: `${((activeStep + 1) / progressSteps.length) * 100}%` }" />
          </div>
          <ul>
            <li v-for="(step, index) in progressSteps" :key="step" :class="{ done: index <= activeStep }">
              {{ step }}
            </li>
          </ul>
        </div>

        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

        <button class="primary-action" :disabled="!canStart" type="button" @click="startDiagnosis">
          {{ isAnalyzing ? '诊断中...' : '开始诊断' }}
        </button>
      </aside>
    </section>

    <section v-else class="report-page">
      <div class="report-toolbar">
        <button class="text-button" type="button" @click="resetDiagnosis">重新诊断</button>
        <strong>{{ report.title }}</strong>
      </div>

      <div class="report-grid">
        <article class="panel score-panel">
          <div class="score-circle">
            <span>{{ report.overallScore }}</span>
          </div>
          <strong>{{ report.level }} · {{ report.category }}</strong>
          <p>{{ report.summary }}</p>
        </article>

        <article v-if="report.verdict" class="panel verdict-panel">
          <h2>爆款判断</h2>
          <div class="verdict-badge">{{ report.verdict.viralPotential }}</div>
          <dl>
            <div>
              <dt>适合策略</dt>
              <dd>{{ report.verdict.bestUse }}</dd>
            </div>
            <div>
              <dt>最大短板</dt>
              <dd>{{ report.verdict.mainBlocker }}</dd>
            </div>
            <div>
              <dt>优先修改</dt>
              <dd>{{ report.verdict.priorityFix }}</dd>
            </div>
          </dl>
        </article>

        <article class="panel dimension-panel">
          <h2>维度评分</h2>
          <div v-for="(value, key) in report.scores" :key="key" class="score-row">
            <span>{{ scoreLabels[key] || key }}</span>
            <div><i :style="{ width: `${value}%` }" /></div>
            <strong>{{ value }}</strong>
          </div>
        </article>

        <article class="panel metrics-panel">
          <h2>公开信息</h2>
          <dl>
            <div v-for="item in report.metrics" :key="item.label">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }} · {{ item.note }}</dd>
            </div>
          </dl>
        </article>

        <article v-if="report.audience" class="panel audience-panel">
          <h2>用户视角</h2>
          <div class="audience-box">
            <span>目标人群</span>
            <p>{{ report.audience.target }}</p>
          </div>
          <div class="audience-box">
            <span>核心需求</span>
            <p>{{ report.audience.need }}</p>
          </div>
          <div class="audience-box">
            <span>停留触发点</span>
            <p>{{ report.audience.trigger }}</p>
          </div>
        </article>

        <article v-if="report.commentInsights" class="panel comment-insights-panel">
          <h2>评论区洞察</h2>
          <div class="comment-status">
            <span>{{ report.commentInsights.status }}</span>
            <strong>{{ report.commentInsights.sentiment }}</strong>
          </div>

          <div class="insight-block">
            <h3>高频关注点</h3>
            <ul>
              <li v-for="item in report.commentInsights.focusPoints" :key="item">{{ item }}</li>
            </ul>
          </div>

          <div class="insight-block">
            <h3>用户质疑/追问</h3>
            <ul>
              <li v-for="item in report.commentInsights.questions" :key="item">{{ item }}</li>
            </ul>
          </div>

          <div class="insight-block">
            <h3>建议回复话术</h3>
            <ul>
              <li v-for="item in report.commentInsights.replySuggestions" :key="item">{{ item }}</li>
            </ul>
          </div>

          <div class="pinned-comment">
            <span>建议置顶评论</span>
            <p>{{ report.commentInsights.pinnedComment }}</p>
          </div>

          <div class="insight-block">
            <h3>下一条选题</h3>
            <ul>
              <li v-for="item in report.commentInsights.nextTopics" :key="item">{{ item }}</li>
            </ul>
          </div>
        </article>

        <article class="panel advice-panel">
          <h2>优化建议</h2>
          <div v-for="item in report.suggestions" :key="item.title" class="advice-item">
            <strong>{{ item.title }}</strong>
            <span v-if="item.priority" class="priority-tag">{{ item.priority }}优先级</span>
            <p>{{ item.detail }}</p>
          </div>
        </article>

        <article v-if="report.checkpoints" class="panel checkpoints-panel">
          <h2>创作检查点</h2>
          <div v-for="item in report.checkpoints" :key="item.label" class="checkpoint-item">
            <div>
              <strong>{{ item.label }}</strong>
              <span>{{ item.status }}</span>
            </div>
            <p>{{ item.advice }}</p>
          </div>
        </article>

        <article class="panel rewrite-panel">
          <h2>AI 优化方案</h2>
          <div class="rewrite-box">
            <span>标题改写</span>
            <p>{{ report.rewrite.title }}</p>
          </div>
          <div class="rewrite-box">
            <span>评论引导</span>
            <p>{{ report.rewrite.commentGuide }}</p>
          </div>
          <div class="rewrite-box">
            <span>重拍方向</span>
            <p>{{ report.rewrite.scriptDirection }}</p>
          </div>
        </article>

        <article class="panel problems-panel">
          <h2>主要问题</h2>
          <ul>
            <li v-for="problem in report.problems" :key="problem">{{ problem }}</li>
          </ul>
          <div v-if="report.actionPlan" class="action-plan">
            <h3>立刻行动</h3>
            <ol>
              <li v-for="action in report.actionPlan" :key="action">{{ action }}</li>
            </ol>
          </div>
          <p class="next-step">下一步：{{ report.nextStep }}</p>
        </article>
      </div>
    </section>
  </main>
</template>
