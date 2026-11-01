const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')

const directory = `${__dirname}/../miniprogram/utils`
const profile = { year: 2002, month: 8, day: 19, hour: 12, gender: 'female' }
const chartSummary = { palaces: [{ name: '命宫' }] }

function load(name, requireModule, wx) {
  const module = { exports: {} }
  new Function('require', 'module', 'exports', 'wx', readFileSync(`${directory}/${name}.js`, 'utf8'))(
    requireModule, module, module.exports, wx,
  )
  return module.exports
}

function device(options = {}) {
  const storage = options.storage || new Map()
  const calls = []
  let userId = 'alice'
  let failWrite = false
  let failRead = false
  let failClear = false
  const quota = { used: 0, remaining: 20 }
  const wx = {
    getStorageSync(key) {
      if (failRead) throw new Error('read failed')
      return storage.get(key) || ''
    },
    setStorageSync(key, value) {
      if (failWrite) throw new Error('storage full')
      storage.set(key, value)
    },
    removeStorageSync(key) {
      if (failClear) throw new Error('clear failed')
      storage.delete(key)
    },
  }
  const defaultServer = async ({ action, ...data }) => {
    if (action === 'getState') return { quota: { ...quota }, ...(options.legacy || {}) }
    if (action === 'saveProfile') return { profile: data.profile, chartSummary, quota: { ...quota } }
    if (action === 'chat') {
      quota.used += 1
      quota.remaining -= 1
      return { answer: options.answer || `answer:${data.question}`, quota: { ...quota } }
    }
    throw new Error(`unexpected cloud action ${action}`)
  }
  const cloudbase = load('cloudbase', (name) => {
    assert.equal(name, '../vendor/cloudbase')
    return {
      init: () => ({
        auth: {
          getSession: async () => ({ data: { session: { user: { id: userId, is_anonymous: false } } } }),
          signInWithOpenId() { throw new Error('login should reuse trusted session') },
        },
        async callFunction({ name, data }) {
          assert.equal(name, 'ziwei-mini')
          calls.push(data)
          const result = await (options.server || defaultServer)(data)
          return { result: { ok: true, data: result } }
        },
      }),
    }
  }, wx)
  const store = load('device-store', () => { throw new Error('unexpected dependency') }, wx)
  const api = load('api', (name) => name === './cloudbase' ? cloudbase : store, wx)
  return {
    api, calls, storage,
    switchUser(id) { userId = id },
    failWrite(value = true) { failWrite = value },
    failRead(value = true) { failRead = value },
    failClear(value = true) { failClear = value },
  }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('another phone starts empty for the same account and never migrates legacy cloud data', async () => {
  const legacy = { profile, chartSummary, messages: [{ role: 'user', content: 'old cloud secret' }] }
  const first = device({ legacy })
  await first.api.saveProfile(profile)
  await first.api.ask('phone one secret')
  const firstState = await first.api.getState()
  assert.equal(firstState.messages.length, 2)
  const second = device({ legacy })
  const fresh = await second.api.getState()
  assert.equal(fresh.profile, null)
  assert.equal(fresh.chartSummary, null)
  assert.deepEqual(fresh.messages, [])
  assert.deepEqual(fresh.quota, { used: 0, remaining: 20 })
  assert.equal(second.storage.size, 0)
  await assert.rejects(second.api.ask('anything'), /这部手机填写出生资料/)
  assert.equal(second.calls.length, 1)
})

test('same-phone account switches use different trusted-session storage namespaces', async () => {
  const phone = device()
  await phone.api.saveProfile(profile)
  await phone.api.ask('alice secret')
  phone.switchUser('bob')
  assert.equal((await phone.api.getState()).profile, null)
  await phone.api.saveProfile({ ...profile, year: 1999 })
  phone.switchUser('alice')
  const alice = await phone.api.getState()
  assert.deepEqual(alice.profile, profile)
  assert.equal(alice.messages[0].content, 'alice secret')
  assert.equal(phone.storage.size, 2)
  assert.ok(phone.calls.every((call) => !('uid' in call) && !('openid' in call)))
})

test('local state survives a client restart only on the same phone', async () => {
  const first = device()
  await first.api.saveProfile(profile)
  await first.api.ask('remember on this phone')
  const restarted = device({ storage: first.storage })
  const state = await restarted.api.getState()
  assert.deepEqual(state.profile, profile)
  assert.equal(state.messages[0].content, 'remember on this phone')
})

test('profile changes clear local history and clearing never calls the cloud or resets quota', async () => {
  const phone = device()
  await phone.api.saveProfile(profile)
  await phone.api.ask('before edit')
  const edited = await phone.api.saveProfile({ ...profile, day: 20 })
  assert.deepEqual(edited.messages, [])
  await phone.api.ask('after edit')
  const beforeClear = phone.calls.length
  const conversation = await phone.api.clearConversation()
  assert.deepEqual(conversation.messages, [])
  assert.equal(conversation.profile.day, 20)
  assert.equal(phone.calls.length, beforeClear)
  await phone.api.clearLocalData()
  assert.equal(phone.storage.size, 0)
  assert.equal(phone.calls.length, beforeClear)
  const fresh = await phone.api.getState()
  assert.equal(fresh.profile, null)
  assert.equal(fresh.quota.remaining, 18)
})

test('chat forwards only the current local profile and bounded recent messages, retaining 18 locally', async () => {
  const phone = device({ answer: '长'.repeat(12000) })
  await phone.api.saveProfile(profile)
  for (let i = 0; i < 10; i += 1) await phone.api.ask(`question ${i}`)
  const chats = phone.calls.filter((call) => call.action === 'chat')
  assert.deepEqual(chats[0], { action: 'chat', profile, messages: [], question: 'question 0' })
  const last = chats.at(-1)
  assert.ok(last.messages.length <= 8)
  assert.ok(last.messages.every((message) => message.content.length <= 8000))
  assert.ok(last.messages.reduce((sum, message) => sum + message.content.length, 0) <= 24000)
  assert.equal(last.messages.at(-1).content, '长'.repeat(8000))
  const state = await phone.api.getState()
  assert.equal(state.messages.length, 18)
  assert.equal(state.messages[0].content, 'question 1')
  assert.equal(state.messages.at(-1).content.length, 12000)
})

for (const mutation of ['clearConversation', 'clearLocalData', 'saveProfile']) {
  test(`${mutation} waits for an in-flight answer and cannot be undone by its old response`, async () => {
    const started = deferred()
    const answer = deferred()
    const phone = device({
      server: async (data) => {
        if (data.action === 'saveProfile') return { profile: data.profile, chartSummary, quota: { remaining: 20 } }
        if (data.action === 'chat') { started.resolve(); return answer.promise }
        return { quota: { remaining: 19 } }
      },
    })
    await phone.api.saveProfile(profile)
    const asking = phone.api.ask('slow question')
    await started.promise
    let finished = false
    const changing = phone.api[mutation]({ ...profile, day: 20 }).then(() => { finished = true })
    await Promise.resolve()
    assert.equal(finished, false)
    answer.resolve({ answer: 'old answer', quota: { remaining: 19 } })
    await Promise.all([asking, changing])
    const state = await phone.api.getState()
    assert.deepEqual(state.messages, [])
    assert.equal(state.profile && state.profile.day, mutation === 'clearLocalData' ? null : mutation === 'saveProfile' ? 20 : 19)
  })
}

test('an account switch during an answer drops the old response before any local write', async () => {
  const started = deferred()
  const answer = deferred()
  const phone = device({
    server: async (data) => {
      if (data.action === 'saveProfile') return { profile: data.profile, chartSummary }
      if (data.action === 'chat') { started.resolve(); return answer.promise }
      return { quota: { remaining: 19 } }
    },
  })
  await phone.api.saveProfile(profile)
  const asking = phone.api.ask('alice question')
  await started.promise
  phone.switchUser('bob')
  answer.resolve({ answer: 'alice answer', quota: { remaining: 19 } })
  await assert.rejects(asking, /微信账号已变化/)
  assert.equal((await phone.api.getState()).profile, null)
  phone.switchUser('alice')
  assert.deepEqual((await phone.api.getState()).messages, [])
})

test('cloud failures do not append messages and local-save failures never report success', async () => {
  const phone = device()
  phone.failWrite()
  await assert.rejects(phone.api.saveProfile(profile), /保存到这部手机失败/)
  assert.equal(phone.storage.size, 0)
  phone.failWrite(false)
  await phone.api.saveProfile(profile)
  phone.failWrite()
  await assert.rejects(phone.api.ask('generated but unsaved'), (error) => {
    assert.match(error.message, /回答已生成.*保存到这部手机失败/)
    assert.equal(error.quota.remaining, 19)
    return true
  })
  phone.failWrite(false)
  assert.deepEqual((await phone.api.getState()).messages, [])
  const offline = device({
    storage: phone.storage,
    server: async () => { throw new Error('offline') },
  })
  await assert.rejects(offline.api.ask('will fail'), /offline/)
  assert.equal([...phone.storage.values()][0].messages.length, 0)
})

test('read and clear errors stay visible, and corrupt local state can be cleared without cloud fallback', async () => {
  const phone = device({ legacy: { profile, chartSummary } })
  phone.failRead()
  await assert.rejects(phone.api.getState(), /读取本机资料失败/)
  phone.failRead(false)
  await phone.api.saveProfile(profile)
  phone.storage.set([...phone.storage.keys()][0], { invalid: true })
  await assert.rejects(phone.api.getState(), /读取本机资料失败/)
  phone.failClear()
  await assert.rejects(phone.api.clearLocalData(), /清除本机资料失败/)
  phone.failClear(false)
  await phone.api.clearLocalData()
  assert.equal((await phone.api.getState()).profile, null)
})
