const { getCloudApp, ensureLogin, sessionUserId } = require('./cloudbase')
const store = require('./device-store')

let pending = Promise.resolve()

// Profile edits and clears wait for the current answer, so an older response
// cannot restore a conversation that the user has just removed.
function exclusive(operation) {
  const result = pending.then(operation, operation)
  pending = result.catch(() => {})
  return result
}

async function currentUserId() {
  return sessionUserId(await ensureLogin())
}

async function requireSameUser(userId) {
  if (await currentUserId() !== userId) throw new Error('微信账号已变化，请重新打开页面')
}

async function callFunction(action, payload, userId) {
  await requireSameUser(userId)
  const response = await getCloudApp().callFunction({
    name: 'ziwei-mini',
    data: { action, ...(payload || {}) },
  })
  await requireSameUser(userId)
  const result = response.result || {}
  if (!result.ok) {
    const error = new Error(result.error || '服务暂时不可用，请稍后再试')
    error.code = result.code
    throw error
  }
  return result.data || {}
}

function recentMessages(messages) {
  let remaining = 24000
  const recent = []
  for (const message of messages.slice(-8).reverse()) {
    if (remaining <= 0) break
    const content = message.content.slice(0, Math.min(8000, remaining))
    if (!content.trim()) continue
    recent.unshift({ role: message.role, content })
    remaining -= content.length
  }
  return recent
}

function getState() {
  return exclusive(async () => {
    const userId = await currentUserId()
    const remote = await callFunction('getState', {}, userId)
    // Ignore legacy cloud profiles, charts and messages. A fresh phone starts
    // empty even when this WeChat account previously used another phone.
    return { ...store.read(userId), quota: remote.quota }
  })
}

function saveProfile(profile) {
  return exclusive(async () => {
    const userId = await currentUserId()
    const previous = store.read(userId)
    const result = await callFunction('saveProfile', { profile }, userId)
    if (!result.profile || !result.chartSummary) throw new Error('排盘结果不完整，请重试')
    const changed = JSON.stringify(previous.profile) !== JSON.stringify(result.profile)
    const state = {
      profile: result.profile,
      chartSummary: result.chartSummary,
      messages: changed ? [] : previous.messages,
    }
    store.write(userId, state)
    return { ...state, quota: result.quota }
  })
}

function ask(rawQuestion) {
  return exclusive(async () => {
    const question = String(rawQuestion || '').trim()
    if (!question) throw new Error('请先写下想问的问题')
    const userId = await currentUserId()
    const state = store.read(userId)
    if (!state.profile) throw new Error('请先在这部手机填写出生资料')
    const result = await callFunction('chat', {
      profile: state.profile,
      messages: recentMessages(state.messages),
      question,
    }, userId)
    if (typeof result.answer !== 'string' || !result.answer.trim()) throw new Error('没有收到完整回答，请稍后再试')
    const messages = state.messages.concat([
      { role: 'user', content: question },
      { role: 'assistant', content: result.answer },
    ]).slice(-18)
    try {
      store.write(userId, { ...state, messages })
    } catch (error) {
      error.message = '回答已生成，但保存到这部手机失败，请检查微信存储空间；本次额度已使用'
      error.quota = result.quota
      throw error
    }
    return { messages, quota: result.quota }
  })
}

function clearConversation() {
  return exclusive(async () => {
    const userId = await currentUserId()
    const state = { ...store.read(userId), messages: [] }
    store.write(userId, state)
    return state
  })
}

function clearLocalData() {
  return exclusive(async () => store.clear(await currentUserId()))
}

module.exports = { getState, saveProfile, ask, clearConversation, clearLocalData }
