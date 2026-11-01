const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

function client(auth) {
  const module = { exports: {} }
  const sdk = {
    init(options) {
      assert.equal(options.env, 'supposed-bovid-d4gcywfkh2af1db6e')
      assert.equal(options.useWxCloud, false)
      assert.ok(options.timeout > 90000)
      return { auth }
    },
  }
  const load = new Function('require', 'module', 'exports', readFileSync(`${__dirname}/../miniprogram/utils/cloudbase.js`, 'utf8'))
  load((name) => {
    assert.equal(name, '../vendor/cloudbase')
    return sdk
  }, module, module.exports)
  return module.exports
}

const signedIn = { data: { session: { user: { id: 'alice', is_anonymous: false } } }, error: null }

test('concurrent page requests share one HTTP WeChat login and reuse its session', async () => {
  let calls = 0
  let session = null
  const cloud = client({
    getSession: async () => ({ data: { session }, error: null }),
    async signInWithOpenId(options) {
      assert.deepEqual(options, { useWxCloud: false })
      calls += 1
      session = signedIn.data.session
      return signedIn
    },
  })
  const sessions = await Promise.all(Array.from({ length: 12 }, () => cloud.ensureLogin()))
  assert.ok(sessions.every((value) => value.user.id === 'alice'))
  assert.equal(calls, 1)
  await cloud.ensureLogin()
  assert.equal(calls, 1)
})

test('a failed login can retry without calling the backend anonymously', async () => {
  let calls = 0
  const cloud = client({
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithOpenId: async () => ++calls === 1 ? { error: new Error('provider unavailable') } : signedIn,
  })
  await assert.rejects(cloud.ensureLogin(), /微信登录暂时失败/)
  assert.equal((await cloud.ensureLogin()).user.id, 'alice')
})

test('an anonymous session is not reused as a WeChat login', async () => {
  let calls = 0
  const cloud = client({
    getSession: async () => ({ data: { session: { user: { is_anonymous: true } } } }),
    signInWithOpenId: async () => { calls += 1; return signedIn },
  })
  await cloud.ensureLogin()
  assert.equal(calls, 1)
})

test('local namespaces require an explicit authenticated session with a nonempty trusted user id', async () => {
  const cloud = client({
    getSession: async () => ({ data: { session: { user: { is_anonymous: false } } } }),
    signInWithOpenId: async () => ({ data: { session: { user: { id: '', is_anonymous: false } } } }),
  })
  await assert.rejects(cloud.ensureLogin(), /微信身份登录/)
  assert.throws(() => cloud.sessionUserId({ user: { id: 'alice' } }), /微信身份登录/)
  assert.throws(() => cloud.sessionUserId({ user: { id: 'alice', is_anonymous: true } }), /微信身份登录/)
  assert.equal(cloud.sessionUserId(signedIn.data.session), 'alice')
})

test('production SDK bundle loads in a Mini Program runtime and uses the HTTP auth endpoint', async () => {
  const requests = []
  const module = { exports: {} }
  const wx = {
    getAccountInfoSync: () => ({ miniProgram: { appId: 'wx7284ee2afe7ed462' } }),
    getSystemInfoSync: () => ({ platform: 'devtools' }),
    getStorageSync: () => null,
    setStorageSync() {},
    removeStorageSync() {},
    getStorage: ({ fail }) => fail({ errMsg: 'not found' }),
    setStorage: ({ success }) => success({}),
    removeStorage: ({ success }) => success({}),
    connectSocket() {},
    onAppShow() {},
    cloud: { init() {}, callFunction() { throw new Error('native cloud call must not be used') } },
    login: ({ success }) => success({ code: 'one-use-test-code' }),
    request(options) {
      requests.push(options.url)
      options.fail({ errMsg: 'offline test', errno: -1 })
      return { abort() {} }
    },
  }
  const timers = new Set()
  const context = {
    module, exports: module.exports, wx, Page() {},
    console: { log() {}, warn() {}, error() {} },
    setTimeout(callback, delay) { const timer = setTimeout(callback, delay); timers.add(timer); return timer },
    clearTimeout,
    setInterval(callback, delay) { const timer = setInterval(callback, delay); timers.add(timer); return timer },
    clearInterval,
    URL, URLSearchParams,
  }
  context.globalThis = context
  try {
    vm.runInNewContext(readFileSync(`${__dirname}/../miniprogram/vendor/cloudbase.js`, 'utf8'), context)
    const app = module.exports.init({
      env: 'supposed-bovid-d4gcywfkh2af1db6e', region: 'ap-shanghai', timeout: 110000, useWxCloud: false,
    })
    assert.equal(typeof app.callFunction, 'function')
    assert.equal(typeof app.auth.getSession, 'function')
    const result = await app.auth.signInWithOpenId({ useWxCloud: false })
    assert.ok(result.error)
    assert.equal(requests.length, 1)
    const request = new URL(requests[0])
    assert.equal(request.hostname, 'supposed-bovid-d4gcywfkh2af1db6e.api.tcloudbasegateway.com')
    assert.equal(request.pathname, '/auth/v1/provider/token')
  } finally {
    for (const timer of timers) { clearTimeout(timer); clearInterval(timer) }
  }
})
