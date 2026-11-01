const cloud = require('wx-server-sdk')
const {
  buildChartContext,
  createChartSummary,
  quotaState,
  validateProfile,
} = require('./domain')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  timeout: 90000,
})

const db = cloud.database()
const USERS = 'ziwei_mini_users'
const DEFAULT_LIMIT = 5
const MAX_HISTORY = 18

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

async function readUser(openid) {
  try {
    const result = await db.collection(USERS).doc(openid).get()
    return result.data || null
  } catch (error) {
    if (
      String(error.errCode) === '-1'
      || /not exist|not found|collection.*missing/i.test(String(error.message))
    ) return null
    throw error
  }
}

async function writeUser(openid, data) {
  await db.collection(USERS).doc(openid).set({
    data: {
      ...data,
      updatedAt: new Date().toISOString(),
    },
  })
}

function publicState(user) {
  const quota = quotaState(user && user.quota, dailyLimit())
  return {
    profile: user ? user.profile || null : null,
    chartSummary: user ? user.chartSummary || null : null,
    messages: user ? user.messages || [] : [],
    quota,
  }
}

async function getState(openid) {
  return success(publicState(await readUser(openid)))
}

async function saveProfile(openid, rawProfile) {
  const profile = validateProfile(rawProfile)
  const chartSummary = createChartSummary(profile)
  const previous = await readUser(openid)
  const profileChanged = JSON.stringify(previous && previous.profile) !== JSON.stringify(profile)

  const next = {
    createdAt: previous && previous.createdAt ? previous.createdAt : new Date().toISOString(),
    profile,
    chartSummary,
    messages: profileChanged ? [] : (previous && previous.messages) || [],
    quota: (previous && previous.quota) || { day: '', count: 0 },
  }
  await writeUser(openid, next)
  return success(publicState(next))
}

async function generateAnswer(messages) {
  const ai = cloud.ai()
  const model = ai.createModel('cloudbase')
  const result = await model.generateText({
    model: process.env.MINI_AI_MODEL || 'deepseek-v4.1-flash',
    messages,
  })

  const text = String(result.text || '').trim()
  if (!text) throw new Error('AI 没有返回内容')
  return text
}

async function chat(openid, rawQuestion) {
  const question = String(rawQuestion || '').trim()
  if (!question) return failure('先写下你想问的问题', 'EMPTY_QUESTION')
  if (question.length > 500) return failure('问题有点长，请控制在 500 字以内', 'QUESTION_TOO_LONG')

  const user = await readUser(openid)
  if (!user || !user.profile || !user.chartSummary) {
    return failure('请先保存出生资料，再开始聊天', 'PROFILE_REQUIRED')
  }

  const quota = quotaState(user.quota, dailyLimit())
  if (quota.remaining <= 0) {
    return failure(`今天的 ${quota.limit} 次提问已经用完，明天再来吧`, 'DAILY_LIMIT')
  }

  const recent = (user.messages || []).slice(-8).map((message) => ({
    role: message.role,
    content: message.content,
  }))
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildChartContext(user.profile, user.chartSummary) },
    ...recent,
    { role: 'user', content: question },
  ]

  let answer
  try {
    answer = await generateAnswer(messages)
  } catch (error) {
    console.error('CloudBase AI failed', error)
    return failure('AI 现在有点忙，请稍后再试；失败不会扣次数', 'AI_UNAVAILABLE')
  }

  const nextMessages = (user.messages || []).concat([
    { role: 'user', content: question, createdAt: new Date().toISOString() },
    { role: 'assistant', content: answer, createdAt: new Date().toISOString() },
  ]).slice(-MAX_HISTORY)
  const nextQuota = { day: quota.day, count: quota.count + 1 }
  const next = { ...user, messages: nextMessages, quota: nextQuota }
  await writeUser(openid, next)

  return success({
    messages: nextMessages,
    quota: quotaState(nextQuota, dailyLimit()),
  })
}

async function clearConversation(openid) {
  const user = await readUser(openid)
  if (!user) return success({ messages: [] })
  const next = { ...user, messages: [] }
  await writeUser(openid, next)
  return success({ messages: [] })
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return failure('无法识别当前微信用户，请重新打开小程序', 'NO_OPENID')

  try {
    switch (event.action) {
      case 'getState':
        return await getState(openid)
      case 'saveProfile':
        return await saveProfile(openid, event.profile)
      case 'chat':
        return await chat(openid, event.question)
      case 'clearConversation':
        return await clearConversation(openid)
      default:
        return failure('接口不存在', 'UNKNOWN_ACTION')
    }
  } catch (error) {
    console.error('ziwei-mini error', event.action, error)
    return failure(error instanceof Error ? error.message : '服务暂时不可用', 'SERVER_ERROR')
  }
}
