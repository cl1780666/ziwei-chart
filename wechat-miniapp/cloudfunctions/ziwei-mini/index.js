const cloud = require('wx-server-sdk')
const cloudbase = require('@cloudbase/node-sdk')
const {
  buildChartContext,
  createChartSummary,
  quotaState,
  validateProfile,
} = require('./domain')
const { createUserStore } = require('./user-store')
const { trustedUserId } = require('./identity')
const { generateAnswer } = require('./ai')
const { createYearlySummary, generateLifetime, validateYear } = require('./fortune')
const { prepareAnalysis, AnalysisInputError } = require('./analysis')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  timeout: 90000,
})

const db = cloud.database()
const auth = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV }).auth()
const DEFAULT_LIMIT = 20
const store = createUserStore(db, { dailyLimit })
const KLINE_FAILURES = {
  KLINE_JSON_PARSE: 'AI曲线格式无法读取，请重试；失败不会扣次数',
  KLINE_GROUP_COUNT: 'AI曲线没有完整10组，请重试；失败不会扣次数',
  KLINE_START_AGE: 'AI曲线分组年龄顺序不正确，请重试；失败不会扣次数',
  KLINE_ROW_COUNT: 'AI曲线分组没有完整10年，请重试；失败不会扣次数',
  KLINE_ROW_SHAPE: 'AI曲线每年数据结构不正确，请重试；失败不会扣次数',
  KLINE_NUMBER_RANGE: 'AI曲线评分不是0–100整数，请重试；失败不会扣次数',
}

const SYSTEM_PROMPT = `你是一位研习紫微斗数多年的命理师“星图先生”。请只依据用户命盘资料和当前问题作答。

要求：
1. 先给明确结论，再说明对应的宫位、星曜或四化依据。
2. 说人话，克制、具体，通常控制在 3–6 个短段落。
3. 吉凶并陈，不恐吓、不奉承，不把术数判断包装成确定事实。
4. 保留必要术语并紧跟通俗解释。
5. 涉及健康、投资或重大人生决定时，只给一般性提醒。
6. 用户要求完整解读时，再按命格、事业财运、情感、人际、健康提醒和建议展开。

术数推演仅供参考，命由天定，事在人为。`

function dailyLimit() {
  const value = Number(process.env.MINI_AI_DAILY_LIMIT)
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_LIMIT
}

function success(data) {
  return { ok: true, data }
}

function failure(error, code = 'UNKNOWN') {
  return { ok: false, error, code }
}

function publicState(user) {
  return { quota: quotaState(user && user.quota, dailyLimit()) }
}

async function getState(openid) {
  return success(publicState(await store.read(openid)))
}

async function saveProfile(openid, rawProfile) {
  let profile
  try {
    profile = validateProfile(rawProfile)
  } catch {
    return failure('出生资料不正确，请检查后再试', 'INVALID_PROFILE')
  }
  const chartSummary = createChartSummary(profile)
  // This read also removes private fields from pre-privacy legacy documents.
  return success({ profile, chartSummary, ...publicState(await store.read(openid)) })
}

function recentMessages(value) {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 8) return null
  const messages = []
  let total = 0
  for (const item of value) {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string') return null
    const content = item.content.trim()
    if (!content || content.length > 8000) return null
    total += content.length
    if (total > 24000) return null
    messages.push({ role: item.role, content })
  }
  return messages
}

async function chat(openid, event, startedAt) {
  const question = typeof event.question === 'string' ? event.question.trim() : ''
  if (!question) return failure('先写下你想问的问题', 'EMPTY_QUESTION')
  if (question.length > 500) return failure('问题有点长，请控制在 500 字以内', 'QUESTION_TOO_LONG')
  let profile
  try {
    profile = validateProfile(event.profile)
  } catch {
    return failure('请先填写有效的出生资料，再开始聊天', 'INVALID_PROFILE')
  }
  const recent = recentMessages(event.messages)
  if (!recent) return failure('聊天上下文不正确或过长，请清空后重试', 'INVALID_MESSAGES')
  // The client sends only its local profile/history. A chart supplied by the
  // client is never trusted; calculate the canonical chart for this request.
  const chartSummary = createChartSummary(profile)
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildChartContext(profile, chartSummary) },
    ...recent,
    { role: 'user', content: question },
  ]
  return runAI(openid, messages, (answer) => ({ answer }), startedAt)
}

async function runAI(openid, messages, decode, startedAt, analysisMode) {
  if (messages.length > 20 || messages.some((message) => message.content.length > 60000)
    || messages.reduce((sum, message) => sum + message.content.length, 0) > 90000
    || Buffer.byteLength(JSON.stringify({ messages }), 'utf8') > 110000) {
    return failure('聊天上下文过长，请清空后重试', 'INVALID_MESSAGES')
  }

  const reservation = await store.reserve(openid)
  if (reservation.code === 'CHAT_IN_PROGRESS') {
    return failure('上一项解读还在进行中，请稍等', 'CHAT_IN_PROGRESS')
  }
  if (reservation.code === 'DAILY_LIMIT') {
    return failure(`今天的 ${reservation.quota.limit} 次提问已经用完，明天再来吧`, 'DAILY_LIMIT')
  }
  let result
  let invalidResponse = false
  try {
    // Include deterministic preparation in the invocation budget. Leave eight
    // seconds for completion/refund transactions before the 90-second limit.
    const timeoutMs = Math.min(80000, 82000 - (Date.now() - startedAt))
    if (timeoutMs <= 0) throw Object.assign(new Error('AI_TIMEOUT'), { code: 'AI_TIMEOUT' })
    const answer = await generateAnswer(messages, {
      timeoutMs,
      ...(analysisMode === 'kline' ? { analysisMode: 'kline' } : {}),
    })
    try {
      result = decode(answer)
    } catch (error) {
      invalidResponse = true
      throw error
    }
  } catch (error) {
    // Error objects can contain request/response text. Log only a safe code.
    const safeCode = ['AI_INCOMPLETE', 'AI_TIMEOUT', 'AI_UPSTREAM'].includes(error && error.code) ? ` ${error.code}` : ''
    const klineCode = invalidResponse && error && typeof error.code === 'string' && Object.hasOwn(KLINE_FAILURES, error.code) ? error.code : null
    console.error(klineCode ? `ziwei-mini ${klineCode}` : invalidResponse ? 'ziwei-mini AI_INVALID_RESPONSE' : `ziwei-mini AI_UNAVAILABLE${safeCode}`)
    await store.release(openid, reservation.id)
    if (klineCode) return failure(KLINE_FAILURES[klineCode], klineCode)
    if (invalidResponse) return failure('AI 返回的数据不完整，请重试；失败不会扣次数', 'AI_INVALID_RESPONSE')
    if (error && error.code === 'AI_TIMEOUT') return failure('AI响应超时，请重试；失败不会扣次数', 'AI_TIMEOUT')
    if (error && error.code === 'AI_INCOMPLETE') return failure('AI输出被截断，请重试；失败不会扣次数', 'AI_INCOMPLETE')
    return failure('AI 现在有点忙，请稍后再试；失败不会扣次数', 'AI_UNAVAILABLE')
  }

  const next = await store.finish(openid, reservation.id)
  if (!next) return failure('这次解读已超时，请重新提问；失败不会扣次数', 'REQUEST_EXPIRED')

  return success({
    ...result,
    quota: quotaState(next.quota, dailyLimit()),
  })
}

async function calculation(openid, event, kind) {
  let profile
  try {
    profile = validateProfile(event.profile)
  } catch {
    return failure('出生资料不正确，请检查后再试', 'INVALID_PROFILE')
  }
  if (kind === 'getYearly') {
    let year
    try { year = validateYear(event.year) } catch { return failure('年份不正确，请选择1900至2199年', 'INVALID_YEAR') }
    if (year < profile.year) return failure('请选择出生年份及以后的年份', 'INVALID_YEAR')
    return success({ yearly: createYearlySummary(profile, year), ...publicState(await store.read(openid)) })
  }
  return success({ points: generateLifetime(profile), ...publicState(await store.read(openid)) })
}

async function analysis(openid, event, startedAt) {
  let plan
  try {
    plan = prepareAnalysis(event)
  } catch (error) {
    if (error instanceof AnalysisInputError) {
      return failure('请检查出生资料、分析项目、年份或合盘对象', error.code)
    }
    throw error
  }
  // prepareAnalysis has already validated the task and canonical inputs.
  // Page-supplied provider/model/token/mode options are never forwarded.
  return runAI(openid, plan.messages, plan.decode, startedAt, event.task === 'kline' ? 'kline' : undefined)
}

async function clearConversation(openid) {
  // Compatibility for older clients. Conversation deletion is now device-local.
  return success({ messages: [], ...publicState(await store.read(openid)) })
}

exports.main = async (event = {}) => {
  try {
    const startedAt = Date.now()
    const userId = trustedUserId(auth)
    if (!userId) return failure('请重新打开小程序完成微信登录', 'AUTH_REQUIRED')
    switch (event.action) {
      case 'getState':
        return await getState(userId)
      case 'saveProfile':
        return await saveProfile(userId, event.profile)
      case 'chat':
        return await chat(userId, event, startedAt)
      case 'getYearly':
      case 'getLifetime':
        return await calculation(userId, event, event.action)
      case 'analysis':
        return await analysis(userId, event, startedAt)
      case 'clearConversation':
        return await clearConversation(userId)
      default:
        return failure('接口不存在', 'UNKNOWN_ACTION')
    }
  } catch {
    console.error('ziwei-mini SERVER_ERROR')
    return failure('服务暂时不可用，请稍后重试', 'SERVER_ERROR')
  }
}
