const { getCloudApp, ensureLogin, sessionUserId } = require('./cloudbase')
const store = require('./device-store')

let pending = Promise.resolve()
const CHART_SCHEMA = 2
const MAX_FEATURE_CACHE = 12
const ANALYSIS_TASKS = ['natal', 'yearly', 'kline', 'klineYear', 'match']

function profileValues(profile) {
  if (!profile || typeof profile !== 'object') return null
  return {
    year: Number(profile.year), month: Number(profile.month), day: Number(profile.day),
    hour: Number(profile.hour), gender: profile.gender,
    birthplace: String(profile.birthplace || '').trim().slice(0, 80),
    trueSolarEnabled: profile.trueSolarEnabled !== false,
  }
}

function cacheKey(task, options = {}, state = {}) {
  return JSON.stringify([
    task, options.year === undefined ? '' : Number(options.year),
    options.age === undefined ? '' : Number(options.age),
    task === 'match' ? profileValues(options.partner || state.partner) : null,
  ])
}

function cacheResult(userId, state, key, result, options = {}) {
  const features = { ...state.features }
  // A small per-device cache prevents accumulated reports exceeding local limits.
  delete features[key]
  features[key] = {
    ...(typeof result.text === 'string' ? { text: result.text } : {}),
    ...(Array.isArray(result.points) ? { points: result.points } : {}),
    ...(result.yearly ? { yearly: result.yearly } : {}),
    ...(options.partner ? { partner: profileValues(options.partner) } : {}),
  }
  while (Object.keys(features).length > MAX_FEATURE_CACHE) delete features[Object.keys(features)[0]]
  store.write(userId, { ...state, features })
}

function requireProfile(state) {
  if (!state.profile) throw new Error('请先在这部手机填写出生资料')
  return state.profile
}

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
    let local = store.read(userId)
    if (local.profile && (!local.chartSummary || local.chartSummary.schemaVersion !== CHART_SCHEMA)) {
      const upgraded = await callFunction('saveProfile', { profile: local.profile }, userId)
      if (!upgraded.profile || !upgraded.chartSummary || upgraded.chartSummary.schemaVersion !== CHART_SCHEMA) {
        throw new Error('完整命盘服务正在更新，请稍后重试')
      }
      local = { ...local, profile: upgraded.profile, chartSummary: upgraded.chartSummary }
      store.write(userId, local)
    }
    return { ...local, quota: remote.quota }
  })
}

function saveProfile(profile) {
  return exclusive(async () => {
    const userId = await currentUserId()
    const previous = store.read(userId)
    const result = await callFunction('saveProfile', { profile }, userId)
    if (!result.profile || !result.chartSummary) throw new Error('排盘结果不完整，请重试')
    const changed = JSON.stringify(profileValues(previous.profile)) !== JSON.stringify(profileValues(result.profile))
    const state = {
      ...previous,
      profile: result.profile,
      chartSummary: result.chartSummary,
      messages: changed ? [] : previous.messages,
      features: changed ? {} : previous.features,
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

function previewProfile(profile) {
  return exclusive(async () => callFunction('saveProfile', { profile }, await currentUserId()))
}

function getFeatureCache(task, options = {}) {
  return exclusive(async () => {
    const state = store.read(await currentUserId())
    return state.features[cacheKey(task, options, state)] || null
  })
}

function getMatchPartner() {
  return exclusive(async () => store.read(await currentUserId()).partner)
}

function saveMatchPartner(profile) {
  return exclusive(async () => {
    const userId = await currentUserId()
    const state = store.read(userId)
    const partner = profileValues(profile)
    if (!partner) throw new Error('请先填写另一位的出生资料')
    store.write(userId, { ...state, partner })
    return partner
  })
}

function calculate(action, task, options = {}) {
  return exclusive(async () => {
    const userId = await currentUserId()
    const state = store.read(userId)
    const profile = requireProfile(state)
    const key = cacheKey(task, options)
    const cached = state.features[key]
    if (cached && (cached.points || cached.yearly)) {
      const remote = await callFunction('getState', {}, userId)
      return { ...cached, quota: remote.quota }
    }
    const result = await callFunction(action, { profile, ...options }, userId)
    cacheResult(userId, state, key, result)
    return result
  })
}

function getYearly(year) {
  return calculate('getYearly', 'yearlyChart', { year: Number(year) })
}

function getLifetime() {
  return calculate('getLifetime', 'lifetime')
}

function analyze(task, options = {}) {
  return exclusive(async () => {
    if (!ANALYSIS_TASKS.includes(task)) throw new Error('解读类型不正确')
    const userId = await currentUserId()
    const state = store.read(userId)
    const profile = requireProfile(state)
    const partner = task === 'match' ? profileValues(options.partner || state.partner) : undefined
    if (task === 'match' && !partner) throw new Error('请先填写另一位的出生资料')
    const params = {
      ...(options.year !== undefined ? { year: Number(options.year) } : {}),
      ...(options.age !== undefined ? { age: Number(options.age) } : {}),
      ...(partner ? { partner } : {}),
    }
    const result = await callFunction('analysis', { task, profile, ...params }, userId)
    if (task === 'kline' ? !Array.isArray(result.points) || result.points.length !== 100
      : typeof result.text !== 'string' || !result.text.trim()) throw new Error('解读结果不完整，请稍后重试')
    try {
      cacheResult(userId, state, cacheKey(task, params), result, params)
    } catch (error) {
      error.message = '解读已生成，但本机保存失败，请检查微信存储空间；本次额度已使用'
      error.quota = result.quota
      throw error
    }
    return result
  })
}

module.exports = {
  getState, saveProfile, ask, clearConversation, clearLocalData,
  previewProfile, getFeatureCache, getMatchPartner, saveMatchPartner,
  getYearly, getLifetime, analyze,
}
