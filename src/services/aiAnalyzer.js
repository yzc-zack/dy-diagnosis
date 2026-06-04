import axios from 'axios'

const DEFAULT_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
const DEFAULT_MODEL = 'qwen-vl-plus'

function buildPrompt({ douyinLink, category, hasCommentScreenshots }) {
  return `你是一个专业的抖音短视频增长诊断师。用户提供了一个抖音视频分享链接，但你不能假装已经真实访问抖音后台数据。请基于链接、类目和短视频增长方法论，生成一份可执行的诊断报告。

${hasCommentScreenshots ? '用户同时上传了评论区截图。请识别截图中的评论内容，重点分析用户真实反馈、质疑点、共鸣点、争议点、潜在选题机会和评论区转化机会。' : '用户没有上传评论区截图。评论区相关结论只能给出推测，并标注需要补充评论区截图。'}

要求：
1. 输出必须是严格 JSON，不要 Markdown，不要解释。
2. 如果无法从链接直接获得标题、播放量、评论等真实信息，要明确标注为“需补充”。
3. 请站在创作者视角回答：这个视频有没有爆款潜质、最大短板是什么、先改哪里最有效。
4. 诊断需要覆盖选题价值、目标人群、开头钩子、标题封面、内容结构、节奏信息密度、情绪价值、互动设计、转化/种草动机、重发重剪策略。
5. 如果有评论区截图，必须单独输出评论区洞察，包括用户情绪、高频关注点、质疑点、适合置顶/回复的话术、下一条选题。
6. 给出内容质量、视觉表现、开头钩子、互动潜力、综合评分，分数 0-100。
7. 给出 3-5 条具体优化建议、1 个改写标题、1 个评论区引导文案、1 个重拍脚本方向。
8. 语气专业、直接、适合中文创作者。建议必须可执行，不要空泛。

JSON 结构：
{
  "title": "视频诊断报告标题",
  "summary": "100字以内总结",
  "overallScore": 67,
  "level": "B",
  "category": "${category}",
  "verdict": {
    "viralPotential": "中等",
    "bestUse": "适合重剪后再发",
    "mainBlocker": "最大阻碍爆款的问题",
    "priorityFix": "最优先改什么"
  },
  "scores": {
    "content": 58,
    "visual": 61,
    "hook": 55,
    "interaction": 59,
    "growth": 67
  },
  "metrics": [
    { "label": "标题清晰度", "value": "需补充", "note": "原因" }
  ],
  "audience": {
    "target": "最可能被这条视频吸引的人群",
    "need": "这类用户最关心的问题",
    "trigger": "最容易触发他们停留/互动的点"
  },
  "commentInsights": {
    "status": "已分析/需补充",
    "sentiment": "评论区整体情绪",
    "focusPoints": ["用户高频关注点1", "用户高频关注点2"],
    "questions": ["用户质疑或追问1", "用户质疑或追问2"],
    "replySuggestions": ["建议回复话术1", "建议回复话术2"],
    "pinnedComment": "建议置顶评论",
    "nextTopics": ["下一条视频选题1", "下一条视频选题2"]
  },
  "problems": ["问题1", "问题2", "问题3"],
  "suggestions": [
    { "title": "建议标题", "priority": "高", "detail": "具体做法" }
  ],
  "checkpoints": [
    { "label": "开头3秒", "status": "待优化", "advice": "怎么改" },
    { "label": "标题封面", "status": "待优化", "advice": "怎么改" },
    { "label": "评论互动", "status": "待优化", "advice": "怎么改" }
  ],
  "rewrite": {
    "title": "改写后的标题",
    "commentGuide": "评论区引导文案",
    "scriptDirection": "重拍脚本方向"
  },
  "actionPlan": ["今天可以立刻做的第1步", "第2步", "第3步"],
  "nextStep": "下一步最该做什么"
}

抖音链接：${douyinLink}`
}

function parseJsonContent(content) {
  const cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  const jsonStart = cleaned.indexOf('{')
  const jsonEnd = cleaned.lastIndexOf('}')

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('AI 返回内容不是 JSON 格式')
  }

  return JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1))
}

function buildUserContent({ douyinLink, category, commentScreenshots }) {
  const prompt = buildPrompt({
    douyinLink,
    category,
    hasCommentScreenshots: commentScreenshots.length > 0,
  })

  return [
    { type: 'text', text: prompt },
    ...commentScreenshots.map((screenshot) => ({
      type: 'image_url',
      image_url: {
        url: screenshot.dataUrl,
      },
    })),
  ]
}

export async function analyzeDouyinVideo({ apiKey, apiUrl, model, douyinLink, category, commentScreenshots = [] }) {
  const resolvedApiKey = apiKey || import.meta.env.VITE_ALIYUN_BAILIAN_API_KEY

  if (!resolvedApiKey) {
    throw new Error('缺少阿里云百炼 API Key。')
  }

  try {
    const response = await axios.post(
      apiUrl || import.meta.env.VITE_AI_API_URL || DEFAULT_API_URL,
      {
        model: model || import.meta.env.VITE_AI_MODEL || DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的短视频内容诊断和增长优化专家，只输出用户要求的 JSON。',
          },
          {
            role: 'user',
            content: buildUserContent({ douyinLink, category, commentScreenshots }),
          },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${resolvedApiKey}`,
          'Content-Type': 'application/json',
        },
      },
    )

    const content = response.data?.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('AI 接口没有返回有效内容')
    }

    return parseJsonContent(content)
  } catch (error) {
    const status = error?.response?.status
    const message = error?.response?.data?.error?.message || error?.response?.data?.message || error?.message

    if (status) {
      throw new Error(`百炼接口请求失败：${status}，${message}`)
    }

    throw new Error(`百炼接口请求失败：${message}`)
  }
}
