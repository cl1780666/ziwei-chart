const cloudbase = require('../vendor/cloudbase')

const ENV_ID = 'supposed-bovid-d4gcywfkh2af1db6e'
let instance
let loginPromise

function sessionUserId(session) {
  const user = session && session.user
  if (!user || user.is_anonymous !== false || typeof user.id !== 'string' || !user.id.trim()) {
    throw new Error('请使用微信身份登录后再试')
  }
  return user.id
}

function getCloudApp() {
  if (!instance) {
    instance = cloudbase.init({
      env: ENV_ID,
      region: 'ap-shanghai',
      timeout: 110000,
      useWxCloud: false,
    })
  }
  return instance
}

function ensureLogin() {
  if (loginPromise) return loginPromise
  loginPromise = (async () => {
    const auth = getCloudApp().auth
    const existing = await auth.getSession()
    const session = existing.data && existing.data.session
    if (!existing.error && session && session.user && session.user.is_anonymous === false &&
      typeof session.user.id === 'string' && session.user.id.trim()) return session

    // This uses wx.login internally and exchanges its one-use code over HTTPS.
    // AppSecret belongs only in the CloudBase identity-source configuration.
    const result = await auth.signInWithOpenId({ useWxCloud: false })
    if (result.error) throw new Error('微信登录暂时失败，请稍后重试')
    const signedIn = result.data && result.data.session
    sessionUserId(signedIn)
    return signedIn
  })().finally(() => { loginPromise = null })
  return loginPromise
}

module.exports = { ENV_ID, getCloudApp, ensureLogin, sessionUserId }
