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

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  timeout: 90000,
})

const db = cloud.database()
const auth = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV }).auth()
const DEFAULT_LIMIT = 20
const store = createUserStore(db, { dailyLimit })

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

async function chat(openid, event) {
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
  if (Buffer.byteLength(JSON.stringify({ messages }), 'utf8') > 110000) {
    return failure('聊天上下文过长，请清空后重试', 'INVALID_MESSAGES')
  }

  const reservation = await store.reserve(openid)
  if (reservation.code === 'CHAT_IN_PROGRESS') {
    return failure('上一条问题还在解读中，请稍等', 'CHAT_IN_PROGRESS')
  }
  if (reservation.code === 'DAILY_LIMIT') {
    return failure(`今天的 ${reservation.quota.limit} 次提问已经用完，明天再来吧`, 'DAILY_LIMIT')
  }
  let answer
  try {
    answer = await generateAnswer(messages)
  } catch {
    // Error objects can contain request/response text. Log only a safe code.
    console.error('ziwei-mini AI_UNAVAILABLE')
    await store.release(openid, reservation.id)
    return failure('AI 现在有点忙，请稍后再试；失败不会扣次数', 'AI_UNAVAILABLE')
  }

  const next = await store.finish(openid, reservation.id)
  if (!next) return failure('这次解读已超时，请重新提问；失败不会扣次数', 'REQUEST_EXPIRED')

  return success({
    answer,
    quota: quotaState(next.quota, dailyLimit()),
  })
}

async function clearConversation(openid) {
  // Compatibility for older clients. Conversation deletion is now device-local.
  return success({ messages: [], ...publicState(await store.read(openid)) })
}

exports.main = async (event = {}) => {
  try {
    const userId = trustedUserId(auth)
    if (!userId) return failure('请重新打开小程序完成微信登录', 'AUTH_REQUIRED')
    switch (event.action) {
      case 'getState':
        return await getState(userId)
      case 'saveProfile':
        return await saveProfile(userId, event.profile)
      case 'chat':
        return await chat(userId, event)
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
