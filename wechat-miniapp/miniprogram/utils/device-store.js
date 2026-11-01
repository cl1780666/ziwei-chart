const KEY_PREFIX = 'ziwei.device.v1:'

function emptyState() {
  return { profile: null, chartSummary: null, messages: [] }
}

function keyFor(userId) {
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new Error('微信登录状态已变化，请重新打开页面')
  }
  return `${KEY_PREFIX}${encodeURIComponent(userId)}`
}

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}

function read(userId) {
  try {
    const saved = wx.getStorageSync(keyFor(userId))
    if (!saved) return emptyState()
    if (saved.version !== 1 || !Array.isArray(saved.messages)) throw new Error('invalid local data')
    return copy({
      profile: saved.profile || null,
      chartSummary: saved.chartSummary || null,
      messages: saved.messages.filter((message) => message &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string').slice(-18),
    })
  } catch (error) {
    throw new Error('读取本机资料失败，请重试或清除本机资料')
  }
}

function write(userId, state) {
  try {
    wx.setStorageSync(keyFor(userId), copy({ version: 1, ...state, messages: state.messages.slice(-18) }))
  } catch (error) {
    throw new Error('保存到这部手机失败，请检查微信存储空间后重试')
  }
}

function clear(userId) {
  try {
    wx.removeStorageSync(keyFor(userId))
  } catch (error) {
    throw new Error('清除本机资料失败，请重试')
  }
  return emptyState()
}

module.exports = { read, write, clear }
