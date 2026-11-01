/* ============================================================
   AI 解读组件
   丝滑流式输出 + 书法字体 + Markdown 渲染
   ============================================================ */

import { useState, useCallback, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChartStore, useSettingsStore, useContentCacheStore } from '@/stores'
import { extractKnowledge, buildPromptContext } from '@/knowledge'
import { buildGuidancePromptContext } from '@/knowledge-db'
import { streamChat, type ChatMessage, type LLMConfig } from '@/lib/llm'
import { Button } from '@/components/ui'

/* ------------------------------------------------------------
   系统提示词
   ------------------------------------------------------------ */

const SYSTEM_PROMPT = `# Role
你是一位研习紫微斗数多年的资深命理师"星图先生"。你精通三合派（观星情格局）、飞星派（推四化轨迹）及钦天门（定气数机缘）。你的论命风格严谨客观，辞藻雅致沉稳，不故弄玄虚，亦不盲目迎合。

# Task
请综合运用上述技法，并根据提供的命盘信息进行解读，对提供的命盘进行全方位推演。分析时需在后台结合"本命、大限、流年"三层结构，但在输出时请转化为用户能理解的语言。

# Analysis Constraints
1. **语言风格**：严禁使用"灵魂底色""磁场""能量"等现代身心灵或互联网词汇。使用更具传统韵味的词汇，如"性情"、"格局"、"机缘"、"运势起伏"。
2. **术语处理**：保留核心术语（如"化禄"、"冲照"、"羊陀"），但必须紧跟通俗解释。
3. **论断原则**：吉凶并陈。既要指出命格的优势（"禄"之所在），也要直言命盘的短板（"忌"之所冲），并给出中肯的修身建议。

# Output Format
请按照以下结构输出分析报告：

## 紫微命盘综合批注

### 壹· 命格总断
* **格局层次**：依据命宫三方四正的星曜组合，用一句话概括命主一生的基本格局高低与成败基调。
* **性情剖析**：结合命宫与福德宫，分析命主显露在外的处世风格，以及内心的真实欲求与精神境界。

### 贰· 事业与财运
* **官禄方向**：依据官禄宫星情与五行属性，指出命主最适合发展的行业性质（如：宜公职、宜经商、或宜技艺求财）。
* **财运机缘**：分析财帛宫强弱。是正财稳健，还是偏财灵动？一生财源主要来自何方？有无漏财之虞？

### 叁· 婚姻与情感
* **姻缘概况**：分析夫妻宫星曜，描述配偶可能的性格特征或相处模式。
* **相处之道**：指出感情中可能存在的隐患（如：沟通不畅、聚少离多），并给出化解建议。

### 肆· 六亲与人际
* **人际关系**：分析迁移宫及交友宫，判断在外是否有贵人扶持，或是易犯小人口舌。
* **家庭关系**：简述与父母、子女的缘分深浅。

### 伍· 运势隐忧与建议
* **健康提醒**：依据疾厄宫，指出先天体质上较弱的环节，提示需注意的身体部位。
* **趋吉避凶**：综合全盘化忌与煞星的落点，指出命主此生最需要修行的"课题"是什么，并给出具体的时间或方位建议。

### 陆· 命格金句
> 请用2-4句话，以诗意且戳心的方式概括命主的核心性格特质。要求：
> - 语言凝练，朗朗上口，适合分享
> - 风格可以是：自嘲式幽默、温柔共情、或霸气宣言
> - 避免空泛的鸡汤，要有具体的性格洞察
> - 格式：用引号包裹，每句话换行

---
*注：术数推演仅供参考，所谓命由天定，事在人为，望君善加把握。*`

const CHAT_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

# Conversation Mode
现在进入命盘问答模式。请结合当前命盘资料和前文对话，直接回答用户的问题。

1. 每次聚焦当前问题，不要重复整份综合报告。
2. 先给明确结论，再用命盘依据解释；必要时说明信息不足。
3. 回答应通俗、具体、克制，通常控制在 3-6 个短段落。
4. 不把术数判断包装成确定事实；涉及健康、投资等问题时只给一般性提醒。`

const QUICK_QUESTIONS = [
  '我的感情里最需要注意什么？',
  '我更适合什么样的工作？',
  '接下来两年的运势重点是什么？',
]

/* ------------------------------------------------------------
   字符输出速度（毫秒/字符）
   ------------------------------------------------------------ */

const CHAR_INTERVAL = 35

/* ------------------------------------------------------------
   Markdown 自定义样式组件
   ------------------------------------------------------------ */

const MarkdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-2xl font-bold text-gold mt-6 mb-3 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-xl font-semibold text-gold/90 mt-5 mb-2">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-lg font-medium text-star-light mt-4 mb-2">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-3 leading-relaxed">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="text-gold font-semibold">{children}</strong>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-none space-y-1.5 mb-3 pl-4">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside space-y-1.5 mb-3 pl-2">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="relative pl-4 before:content-['◆'] before:absolute before:left-0 before:text-star/60 before:text-xs">
      {children}
    </li>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-gold/40 pl-4 my-3 italic text-text-secondary">
      {children}
    </blockquote>
  ),
}

/* ------------------------------------------------------------
   AI 解读面板组件
   ------------------------------------------------------------ */

export function AIInterpretation() {
  const { chart, birthInfo } = useChartStore()
  const { provider, providerSettings, enableThinking, enableWebSearch, searchApiKey } = useSettingsStore()
  const {
    aiInterpretation,
    setAiInterpretation,
    aiConversation,
    setAiConversation,
  } = useContentCacheStore()
  const currentSettings = providerSettings[provider]

  // 显示的文本（逐字输出）
  const [displayText, setDisplayText] = useState('')
  // 完整文本（缓冲区）
  const fullTextRef = useRef('')
  // 当前显示位置
  const displayIndexRef = useRef(0)
  // 定时器
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // 是否正在接收（ref 用于定时器闭包）
  const loadingRef = useRef(false)
  const [loading, setLoading] = useState(false)
  // 是否正在输出动画
  const [animating, setAnimating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [chatReply, setChatReply] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  // 组件挂载时，如果有缓存则直接显示
  useEffect(() => {
    if (aiInterpretation && !displayText) {
      setDisplayText(aiInterpretation)
      fullTextRef.current = aiInterpretation
      displayIndexRef.current = aiInterpretation.length
    }
  }, [aiInterpretation, displayText])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [aiConversation, chatReply])

  /* ------------------------------------------------------------
     均匀输出字符的定时器
     ------------------------------------------------------------ */

  const startAnimation = useCallback(() => {
    if (timerRef.current) return

    setAnimating(true)
    timerRef.current = setInterval(() => {
      if (displayIndexRef.current < fullTextRef.current.length) {
        displayIndexRef.current++
        setDisplayText(fullTextRef.current.slice(0, displayIndexRef.current))
      } else if (!loadingRef.current) {
        // 输出完成且不再加载
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        setAnimating(false)
      }
    }, CHAR_INTERVAL)
  }, [])

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  /* ------------------------------------------------------------
     开始解读
     ------------------------------------------------------------ */

  const handleInterpret = useCallback(async () => {
    if (!chart || !birthInfo) return

    // 重置状态
    loadingRef.current = true
    setLoading(true)
    setError(null)
    setDisplayText('')
    fullTextRef.current = ''
    displayIndexRef.current = 0

    // 清理旧定时器
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    try {
      // 提取知识上下文
      const knowledge = extractKnowledge(chart, birthInfo.year)
      const contextStr = buildPromptContext(knowledge)
      const guidanceContext = buildGuidancePromptContext({
        knowledge,
        task: 'natal',
        limit: 12,
      })

      // 构建用户消息
      const userMessage = `请解读以下命盘：

## 基本信息
- 阳历：${birthInfo.year}年${birthInfo.month}月${birthInfo.day}日
- 性别：${birthInfo.gender === 'male' ? '男' : '女'}
- 五行局：${chart.fiveElementsClass}

${contextStr}

${guidanceContext}

请给出详细但通俗易懂的命盘解读。`

      const messages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ]

      const config: LLMConfig = {
        provider,
        apiKey: currentSettings.apiKey,
        baseUrl: currentSettings.customBaseUrl || undefined,
        model: currentSettings.customModel || undefined,
        enableThinking,
        enableWebSearch,
        searchApiKey: searchApiKey || undefined,
      }

      // 启动均匀输出动画
      startAnimation()

      // 流式接收，写入缓冲区
      for await (const token of streamChat(config, messages)) {
        fullTextRef.current += token
      }

      // 保存到全局缓存
      setAiInterpretation(fullTextRef.current)
    } catch (err) {
      setError(err instanceof Error ? err.message : '解读失败，请重试')
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [chart, birthInfo, provider, currentSettings, enableThinking, enableWebSearch, searchApiKey, startAnimation, setAiInterpretation])

  const handleAsk = useCallback(async (suggestedQuestion?: string) => {
    const nextQuestion = (suggestedQuestion ?? question).trim()
    if (!chart || !birthInfo || !nextQuestion || chatLoading) return

    const userEntry = { role: 'user' as const, content: nextQuestion }
    const nextConversation = [...aiConversation, userEntry]
    setAiConversation(nextConversation)
    setQuestion('')
    setChatReply('')
    setChatError(null)
    setChatLoading(true)

    try {
      const knowledge = extractKnowledge(chart, birthInfo.year)
      const contextStr = buildPromptContext(knowledge)
      const guidanceContext = buildGuidancePromptContext({
        knowledge,
        task: 'natal',
        limit: 12,
      })
      const chartContext = `以下是当前问答所依据的命盘资料：

## 基本信息
- 阳历：${birthInfo.year}年${birthInfo.month}月${birthInfo.day}日
- 性别：${birthInfo.gender === 'male' ? '男' : '女'}
- 五行局：${chart.fiveElementsClass}

${contextStr}

${guidanceContext}`

      const recentConversation: ChatMessage[] = aiConversation.slice(-8).map((entry) => ({
        role: entry.role,
        content: entry.content,
      }))
      const messages: ChatMessage[] = [
        { role: 'system', content: CHAT_SYSTEM_PROMPT },
        { role: 'user', content: chartContext },
        ...(aiInterpretation
          ? [{ role: 'assistant' as const, content: `此前的综合解读如下：\n${aiInterpretation.slice(0, 12_000)}` }]
          : []),
        ...recentConversation,
        userEntry,
      ]
      const config: LLMConfig = {
        provider,
        apiKey: currentSettings.apiKey,
        baseUrl: currentSettings.customBaseUrl || undefined,
        model: currentSettings.customModel || undefined,
        enableThinking,
        enableWebSearch,
        searchApiKey: searchApiKey || undefined,
      }

      let reply = ''
      for await (const token of streamChat(config, messages)) {
        reply += token
        setChatReply(reply)
      }

      if (!reply.trim()) throw new Error('AI 没有返回内容，请重试')
      setAiConversation([...nextConversation, { role: 'assistant', content: reply }])
      setChatReply('')
    } catch (err) {
      setChatError(err instanceof Error ? err.message : '回答失败，请重试')
    } finally {
      setChatLoading(false)
    }
  }, [
    aiConversation,
    aiInterpretation,
    birthInfo,
    chart,
    chatLoading,
    currentSettings,
    enableThinking,
    enableWebSearch,
    provider,
    question,
    searchApiKey,
    setAiConversation,
  ])

  if (!chart) return null

  return (
    <div
      className="
        relative p-6 lg:p-8
        bg-gradient-to-br from-white/[0.04] to-transparent
        backdrop-blur-xl border border-white/[0.08] rounded-2xl
        shadow-[0_8px_32px_rgba(0,0,0,0.3)]
      "
    >
      {/* 顶部发光线 */}
      <div
        className="
          absolute top-0 left-1/2 -translate-x-1/2
          w-1/3 h-px
          bg-gradient-to-r from-transparent via-gold/50 to-transparent
        "
      />

      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <h2
          className="
            text-xl lg:text-2xl font-semibold
            bg-gradient-to-r from-gold via-gold-light to-gold
            bg-clip-text text-transparent
          "
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          AI 命盘解读
        </h2>
        <Button
          onClick={handleInterpret}
          disabled={loading}
          size="sm"
          variant="gold"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-night border-t-transparent rounded-full animate-spin" />
              解读中
            </span>
          ) : '开始解读'}
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="p-3 rounded-lg bg-misfortune/10 text-misfortune text-sm mb-4 border border-misfortune/20">
          {error}
        </div>
      )}

      {/* 共享 AI 提示 */}
      {!displayText && !loading && (
        <div className="text-text-muted text-sm py-8 text-center">
          <div className="text-3xl mb-3 opacity-30">☆</div>
          可以先生成综合解读，也可以直接在下方问一个具体问题。
        </div>
      )}

      {/* 解读内容 - 书法字体 + Markdown 渲染 */}
      {displayText && (
        <div
          className="
            prose prose-invert max-w-none
            text-text-secondary text-lg lg:text-xl leading-loose
          "
          style={{ fontFamily: 'var(--font-brush)' }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={MarkdownComponents}
          >
            {displayText}
          </ReactMarkdown>

          {/* 光标指示器 */}
          {animating && (
            <span className="inline-block w-0.5 h-5 bg-gold/80 animate-pulse ml-0.5 align-middle" />
          )}
        </div>
      )}

      {/* 加载占位 */}
      {loading && !displayText && (
        <div className="flex items-center justify-center gap-3 text-text-muted py-12">
          <div className="w-5 h-5 border-2 border-star border-t-transparent rounded-full animate-spin" />
          <span>正在分析命盘...</span>
        </div>
      )}

      <div className="mt-8 border-t border-white/[0.08] pt-6">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-rose-100">继续问星图先生</h3>
            <p className="mt-1 text-sm text-text-muted">围绕这张命盘继续追问，回答会参考前面的对话。</p>
          </div>
          <span className="text-xs text-text-muted">每次发送使用 1 次共享 AI 次数</span>
        </div>

        {aiConversation.length === 0 && !chatLoading && (
          <div className="mb-5 flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => void handleAsk(item)}
                className="rounded-full border border-rose-200/15 bg-rose-200/[0.05] px-3 py-2 text-sm text-rose-100/80 transition hover:border-rose-200/30 hover:bg-rose-200/[0.1]"
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {(aiConversation.length > 0 || chatReply) && (
          <div className="mb-5 max-h-[34rem] space-y-4 overflow-y-auto pr-1">
            {aiConversation.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 sm:max-w-[78%] ${
                    message.role === 'user'
                      ? 'rounded-br-md bg-gradient-to-r from-rose-300/80 to-violet-300/80 text-night'
                      : 'rounded-bl-md border border-white/[0.08] bg-white/[0.045] text-text-secondary'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))}

            {chatReply && (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-white/[0.08] bg-white/[0.045] px-4 py-3 text-sm leading-7 text-text-secondary sm:max-w-[78%]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                    {chatReply}
                  </ReactMarkdown>
                  <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-rose-200/80 align-middle" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        {chatError && (
          <div className="mb-4 rounded-lg border border-misfortune/20 bg-misfortune/10 p-3 text-sm text-misfortune">
            {chatError}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void handleAsk()
              }
            }}
            placeholder="比如：我的感情模式有什么特点？"
            rows={3}
            maxLength={1_000}
            disabled={chatLoading}
            className="min-h-24 flex-1 resize-y rounded-2xl border border-white/[0.1] bg-night/40 px-4 py-3 text-sm leading-6 text-text outline-none transition placeholder:text-text-muted/60 focus:border-rose-200/40 focus:ring-2 focus:ring-rose-200/10 disabled:opacity-60"
          />
          <Button
            type="button"
            variant="gold"
            onClick={() => void handleAsk()}
            disabled={chatLoading || !question.trim()}
            className="sm:min-w-24"
          >
            {chatLoading ? '回答中' : '发送'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-text-muted">按 Enter 发送，Shift + Enter 换行。术数解读仅供参考。</p>
      </div>
    </div>
  )
}
