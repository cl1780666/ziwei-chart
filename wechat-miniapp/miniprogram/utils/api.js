function callFunction(action, payload) {
  const app = getApp()

  return wx.cloud.callFunction({
    name: app.globalData.functionName,
    config: { env: app.globalData.envId },
    data: {
      action,
      ...(payload || {}),
    },
  }).then((response) => {
    const result = response.result || {}
    if (!result.ok) {
      const error = new Error(result.error || '服务暂时不可用，请稍后再试')
      error.code = result.code
      throw error
    }
    return result.data
  })
}

module.exports = {
  getState: () => callFunction('getState'),
  saveProfile: (profile) => callFunction('saveProfile', { profile }),
  ask: (question) => callFunction('chat', { question }),
  clearConversation: () => callFunction('clearConversation'),
}
