const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')

const directory = `${__dirname}/../miniprogram/utils`
const profile = { year: 2002, month: 8, day: 19, hour: 12, gender: 'female' }
const chartSummary = { schemaVersion: 2, palaces: [{ name: '命宫' }] }

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
    if (action === 'getYearly') return { yearly: { year: data.year, palaceName: '官禄' }, quota: { ...quota } }
    if (action === 'getLifetime') return { points: Array.from({ length: 100 }, (_, i) => ({ age: i + 1 })), quota: { ...quota } }
    if (action === 'analysis') {
      quota.used += 1
      quota.remaining -= 1
      return data.task === 'kline'
        ? { points: Array.from({ length: 100 }, (_, i) => ({ age: i + 1 })), quota: { ...quota } }
        : { text: `report:${data.task}:${data.year || ''}:${data.partner && data.partner.year || ''}`, quota: { ...quota } }
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

test('reports, lifetime curves and partner drafts stay on the current device and account', async () => {
  const first = device()
  await first.api.saveProfile(profile)
  const partner = { ...profile, year: 1999, gender: 'male' }
  await first.api.saveMatchPartner(partner)
  const preview = await first.api.previewProfile(partner)
  assert.equal(preview.profile.year, 1999)
  assert.equal((await first.api.getState()).profile.year, 2002)
  await first.api.analyze('natal')
  await first.api.analyze('match', { partner })
  const curve = await first.api.getLifetime()
  assert.equal(curve.points.length, 100)
  const year = await first.api.getYearly(2027)
  assert.equal(year.yearly.year, 2027)
  assert.equal(year.quota.remaining, 18)
  const calculations = first.calls.filter((call) => ['getYearly', 'getLifetime'].includes(call.action)).length
  await first.api.getYearly(2027)
  await first.api.getLifetime()
  assert.equal(first.calls.filter((call) => ['getYearly', 'getLifetime'].includes(call.action)).length, calculations)
  assert.match((await first.api.getFeatureCache('match', { partner })).text, /1999/)
  assert.equal(await first.api.getFeatureCache('match', { partner: { ...partner, year: 1998 } }), null)
  const restarted = device({ storage: first.storage })
  assert.match((await restarted.api.getFeatureCache('natal')).text, /natal/)
  assert.equal((await restarted.api.getMatchPartner()).year, 1999)
  const otherPhone = device()
  assert.equal(await otherPhone.api.getFeatureCache('natal'), null)
  assert.equal(await otherPhone.api.getMatchPartner(), null)
  first.switchUser('bob')
  assert.equal(await first.api.getFeatureCache('natal'), null)
  assert.equal(await first.api.getMatchPartner(), null)
})

test('year-specific reports do not collide and profile edits invalidate all primary-chart reports', async () => {
  const phone = device()
  await phone.api.saveProfile(profile)
  await phone.api.analyze('yearly', { year: 2026 })
  await phone.api.analyze('yearly', { year: 2027 })
  assert.match((await phone.api.getFeatureCache('yearly', { year: 2026 })).text, /2026/)
  assert.match((await phone.api.getFeatureCache('yearly', { year: 2027 })).text, /2027/)
  await phone.api.clearConversation()
  assert.ok(await phone.api.getFeatureCache('yearly', { year: 2026 }))
  await phone.api.saveProfile({ ...profile, day: 20 })
  assert.equal(await phone.api.getFeatureCache('yearly', { year: 2026 }), null)
  await phone.api.analyze('natal')
  await phone.api.clearLocalData()
  assert.equal(await phone.api.getFeatureCache('natal'), null)
})

test('legacy local charts upgrade without importing cloud content or dropping local conversations', async () => {
  const phone = device({ legacy: { messages: [{ role: 'user', content: 'cloud secret' }] } })
  await phone.api.saveProfile(profile)
  await phone.api.ask('local only')
  const [key, saved] = [...phone.storage.entries()][0]
  saved.chartSummary = { palaces: [{ name: '旧命宫' }] }
  phone.storage.set(key, saved)
  const state = await phone.api.getState()
  assert.equal(state.chartSummary.schemaVersion, 2)
  assert.equal(state.messages[0].content, 'local only')
  const calculationCount = phone.calls.filter((call) => call.action === 'saveProfile').length
  await phone.api.getState()
  assert.equal(phone.calls.filter((call) => call.action === 'saveProfile').length, calculationCount)
})

test('bounded local feature cache discards oldest reports and serializes profile edits during analysis', async () => {
  const phone = device()
  await phone.api.saveProfile(profile)
  for (let year = 2020; year < 2035; year += 1) await phone.api.analyze('yearly', { year })
  const state = await phone.api.getState()
  assert.equal(Object.keys(state.features).length, 12)
  assert.equal(await phone.api.getFeatureCache('yearly', { year: 2020 }), null)
  assert.ok(await phone.api.getFeatureCache('yearly', { year: 2034 }))

  const started = deferred()
  const answer = deferred()
  const slow = device({ server: async (data) => {
    if (data.action === 'saveProfile') return { profile: data.profile, chartSummary }
    if (data.action === 'analysis') { started.resolve(); return answer.promise }
    return { quota: { remaining: 19 } }
  } })
  await slow.api.saveProfile(profile)
  const analyzing = slow.api.analyze('natal')
  await started.promise
  const editing = slow.api.saveProfile({ ...profile, day: 20 })
  answer.resolve({ text: 'old profile report', quota: { remaining: 19 } })
  await Promise.all([analyzing, editing])
  assert.equal(await slow.api.getFeatureCache('natal'), null)
  assert.equal((await slow.api.getState()).profile.day, 20)
})
