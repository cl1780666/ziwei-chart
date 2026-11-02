const { ENV_ID, ensureLogin } = require('./utils/cloudbase')
const music = require('./utils/music')

App({
  globalData: {
    envId: ENV_ID,
    functionName: 'ziwei-mini',
  },

  onLaunch() {
    // Page API calls await the same login. A failed launch login can be retried
    // on the next action, without leaving an unhandled rejected promise.
    ensureLogin().catch(() => {})
    // Attempt foreground BGM from the first track. Native playback events,
    // rather than this call, determine whether sound actually starts.
    music.start()
  },

  onShow() { music.onAppShow() },
  onHide() { music.onAppHide() },
})
