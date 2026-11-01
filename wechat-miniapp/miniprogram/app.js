const { ENV_ID, ensureLogin } = require('./utils/cloudbase')

App({
  globalData: {
    envId: ENV_ID,
    functionName: 'ziwei-mini',
  },

  onLaunch() {
    // Page API calls await the same login. A failed launch login can be retried
    // on the next action, without leaving an unhandled rejected promise.
    ensureLogin().catch(() => {})
  },
})
