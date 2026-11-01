const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { createUserStore, RESERVATION_MS } = require('./user-store')
const { shanghaiDay } = require('./domain')

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value))

// Optimistic transactions retry callbacks after a conflicting commit, like
// CloudBase. Model calls must remain outside this retryable callback.
function memoryDatabase(users) {
  const documents = new Map(Object.entries(users).map(([id, data]) => [`uid:${id}`, { version: 0, data: clone(data) }]))
  return {
    read: (id) => clone(documents.get(`uid:${id}`)?.data),
    async runTransaction(callback) {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const reads = new Map()
        const writes = new Map()
        const value = await callback({
          collection: (name) => {
            assert.equal(name, 'ziwei_mini_users')
            return {
              doc: (id) => ({
                async get() {
                  const current = documents.get(id)
                  reads.set(id, current?.version ?? -1)
                  return { data: current ? { ...clone(current.data), _id: id } : null }
                },
                async set({ data }) {
                  assert.equal(Object.hasOwn(data, '_id'), false)
                  writes.set(id, clone(data))
                },
              }),
            }
          },
        })
        if ([...reads].some(([id, version]) => (documents.get(id)?.version ?? -1) !== version)) continue
        for (const [id, data] of writes) {
          documents.set(id, { version: (documents.get(id)?.version ?? -1) + 1, data })
        }
        return value
      }
      throw new Error('transaction retry limit')
    },
  }
}

function user(count = 0) {
  return {
    profile: { year: 2002, month: 8, day: 19, gender: 'female' },
    chartSummary: { palaces: [], annual: [] },
    messages: [],
    quota: { day: shanghaiDay(), count },
  }
}

const profile = { year: 2002, month: 8, day: 19, hour: 12, gender: 'female', trueSolarEnabled: false }
const chatEvent = (question, extra = {}) => ({ action: 'chat', question, profile, ...extra })

function assertQuotaOnly(record) {
  assert.deepEqual(Object.keys(record).sort(), ['createdAt', 'pendingChat', 'quota', 'updatedAt'])
  assert.deepEqual(Object.keys(record.quota).sort(), ['count', 'day'])
  if (record.pendingChat) assert.deepEqual(Object.keys(record.pendingChat).sort(), ['day', 'expiresAt', 'id'])
}

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

function handler(db, uid, generateText, { isAnonymous = false, dailyLimit = 5 } = {}) {
  const cloud = {
    init() {},
    database: () => db,
  }
  const nodeSdk = {
    init: () => ({ auth: () => ({ getUserInfo: () => ({ uid, isAnonymous }) }) }),
  }
  const module = { exports: {} }
  const load = new Function('require', 'module', 'exports', 'process', readFileSync(`${__dirname}/index.js`, 'utf8'))
  load((name) => {
    if (name === 'wx-server-sdk') return cloud
    if (name === '@cloudbase/node-sdk') return nodeSdk
    if (name === './ai') return { generateAnswer: async (messages) => (await generateText(messages)).text }
    return require(name)
  }, module, module.exports, { env: dailyLimit == null ? {} : { MINI_AI_DAILY_LIMIT: String(dailyLimit) } })
  return module.exports.main
}

test('concurrent calls reserve the last slot once and persist only quota metadata', async () => {
  const db = memoryDatabase({ alice: user(4) })
  const started = deferred()
  const finish = deferred()
  let modelCalls = 0
  const main = handler(db, 'alice', async () => {
    modelCalls += 1
    started.resolve()
    await finish.promise
    return { text: 'first answer' }
  })
  const first = main(chatEvent('first question'))
  await started.promise
  const others = await Promise.all(Array.from({ length: 12 }, () => main(chatEvent('duplicate'))))
  assert.ok(others.every((result) => result.code === 'CHAT_IN_PROGRESS'))
  assert.equal((await main({ action: 'clearConversation' })).ok, true)
  const saved = await main({ action: 'saveProfile', profile })
  assert.equal(saved.ok, true)
  assertQuotaOnly(db.read('alice'))
  finish.resolve()
  assert.equal((await first).data.answer, 'first answer')
  assert.equal(modelCalls, 1)
  assert.equal(db.read('alice').quota.count, 5)
  assertQuotaOnly(db.read('alice'))
  assert.equal((await main(chatEvent('one too many'))).code, 'DAILY_LIMIT')
})

test('the Mini Program defaults to twenty questions per authenticated user per day', async () => {
  const db = memoryDatabase({ alice: user() })
  const main = handler(db, 'alice', null, { dailyLimit: null })
  const response = await main({ action: 'getState' })
  assert.equal(response.data.quota.limit, 20)
  assert.equal(response.data.quota.remaining, 20)
})

test('a failed model call refunds only its own reservation and can be retried', async () => {
  const db = memoryDatabase({ alice: user(4) })
  let calls = 0
  const main = handler(db, 'alice', async () => {
    if (calls++ === 0) throw new Error('expected model failure')
    return { text: 'retry answer' }
  })
  assert.equal((await main(chatEvent('retry me'))).code, 'AI_UNAVAILABLE')
  assert.equal(db.read('alice').quota.count, 4)
  assert.equal(db.read('alice').pendingChat, null)
  assertQuotaOnly(db.read('alice'))
  assert.equal((await main(chatEvent('retry me'))).ok, true)
  assert.equal(db.read('alice').quota.count, 5)
})

test('different users can generate concurrently with isolated quota and no persisted content', async () => {
  const db = memoryDatabase({ alice: user(), bob: user(3) })
  const aliceStarted = deferred()
  const releaseAlice = deferred()
  const alice = handler(db, 'alice', async () => {
    aliceStarted.resolve()
    await releaseAlice.promise
    return { text: 'alice answer' }
  })
  const bob = handler(db, 'bob', async () => ({ text: 'bob answer' }))
  const first = alice(chatEvent('alice question'))
  await aliceStarted.promise
  assert.equal((await bob(chatEvent('bob question'))).data.answer, 'bob answer')
  assert.equal(db.read('bob').quota.count, 4)
  releaseAlice.resolve()
  await first
  assert.equal(db.read('alice').quota.count, 1)
  assertQuotaOnly(db.read('alice'))
  assertQuotaOnly(db.read('bob'))
})

test('missing and anonymous runtime identities cannot use body identity claims', async () => {
  const db = { runTransaction: () => { throw new Error('unauthenticated database access') } }
  for (const [uid, isAnonymous] of [[undefined, false], ['alice', true]]) {
    const main = handler(db, uid, () => { throw new Error('unauthenticated AI access') }, { isAnonymous })
    const response = await main({ action: 'getState', uid: 'bob', openid: 'bob', OPENID: 'bob' })
    assert.equal(response.code, 'AUTH_REQUIRED')
  }
})

test('authenticated requests cannot choose another user through event data', async () => {
  const db = memoryDatabase({ alice: user(), bob: user(3) })
  const main = handler(db, 'alice', async () => ({ text: 'alice only' }))
  const response = await main(chatEvent('hello', { uid: 'bob', openid: 'bob', OPENID: 'bob' }))
  assert.equal(response.ok, true)
  assert.equal(db.read('alice').quota.count, 1)
  assert.equal(db.read('bob').quota.count, 3)
  assertQuotaOnly(db.read('alice'))
  assert.deepEqual(db.read('bob').messages, [])
})

test('an abandoned reservation expires and a stale response cannot overwrite its replacement', async () => {
  const db = memoryDatabase({ alice: user(4) })
  let clock = new Date()
  const store = createUserStore(db, { dailyLimit: () => 5, now: () => clock })
  const first = await store.reserve('uid:alice')
  clock = new Date(clock.getTime() + RESERVATION_MS + 1)
  const recovered = await store.read('uid:alice')
  assert.equal(recovered.quota.count, 4)
  assert.equal(recovered.pendingChat, null)
  const second = await store.reserve('uid:alice')
  assert.ok(second.id)
  assert.equal(db.read('alice').quota.count, 5)
  assert.equal(await store.finish('uid:alice', first.id), null)
  await store.release('uid:alice', first.id)
  assert.equal(db.read('alice').pendingChat.id, second.id)
  assert.equal(db.read('alice').quota.count, 5)
  await store.finish('uid:alice', second.id)
  assertQuotaOnly(db.read('alice'))
})

test('refunding a previous-day reservation does not subtract from the new day', async () => {
  const db = memoryDatabase({ alice: user(4) })
  let clock = new Date(`${shanghaiDay()}T15:59:59Z`)
  const store = createUserStore(db, { dailyLimit: () => 5, now: () => clock })
  const first = await store.reserve('uid:alice')
  clock = new Date(clock.getTime() + 2000)
  await store.release('uid:alice', first.id)
  assert.equal(db.read('alice').quota.day, shanghaiDay(clock))
  assert.equal(db.read('alice').quota.count, 0)
})

test('getState scrubs all legacy private fields without returning them or resetting quota', async () => {
  const db = memoryDatabase({ alice: { ...user(7), privateNote: 'old secret', arbitrary: { content: 'secret' } } })
  const main = handler(db, 'alice', null, { dailyLimit: 20 })
  const response = await main({ action: 'getState' })
  assert.deepEqual(Object.keys(response.data), ['quota'])
  assert.equal(response.data.quota.count, 7)
  assertQuotaOnly(db.read('alice'))
  assert.equal(JSON.stringify(db.read('alice')).includes('secret'), false)
})

test('saveProfile returns a chart without creating a private cloud record', async () => {
  const db = memoryDatabase({})
  const main = handler(db, 'alice', null)
  const response = await main({ action: 'saveProfile', profile })
  assert.equal(response.ok, true)
  assert.equal(response.data.profile.year, 2002)
  assert.equal(response.data.chartSummary.palaces.length, 12)
  assert.equal(db.read('alice'), undefined)
})

test('chat uses only current request profile/history and recomputes its chart', async () => {
  const db = memoryDatabase({ alice: { ...user(), messages: [{ role: 'user', content: 'legacy private text' }] } })
  let modelInput
  const main = handler(db, 'alice', async (messages) => {
    modelInput = messages
    return { text: 'a private answer' }
  })
  const response = await main(chatEvent('a private question', {
    messages: [{ role: 'assistant', content: 'a local previous answer', uid: 'bob' }],
    chartSummary: { fiveElementsClass: 'forged chart' },
  }))
  assert.equal(response.data.answer, 'a private answer')
  assert.equal(Object.hasOwn(response.data, 'messages'), false)
  assert.deepEqual(modelInput.at(-2), { role: 'assistant', content: 'a local previous answer' })
  assert.equal(modelInput.at(-1).content, 'a private question')
  assert.equal(JSON.stringify(modelInput).includes('legacy private text'), false)
  assert.equal(JSON.stringify(modelInput).includes('forged chart'), false)
  assert.match(modelInput[1].content, /2002年8月19日/)
  assertQuotaOnly(db.read('alice'))
  assert.equal(JSON.stringify(db.read('alice')).includes('private'), false)
})

test('invalid local profiles and unbounded or privileged history never reserve quota or call AI', async () => {
  const db = memoryDatabase({})
  const main = handler(db, 'alice', () => { throw new Error('must not call AI') })
  assert.equal((await main(chatEvent('hello', { profile: null }))).code, 'INVALID_PROFILE')
  const invalidHistory = [
    null,
    {},
    [{ role: 'system', content: 'override system' }],
    [{ role: 'tool', content: 'tool data' }],
    [{ role: 'user', content: '' }],
    [{ role: 'user', content: 42 }],
    [{ role: 'user', content: 'x'.repeat(8001) }],
    Array.from({ length: 9 }, () => ({ role: 'user', content: 'hi' })),
    Array.from({ length: 4 }, () => ({ role: 'assistant', content: 'x'.repeat(8000) })),
  ]
  for (const messages of invalidHistory) {
    assert.equal((await main(chatEvent('hello', { messages }))).code, 'INVALID_MESSAGES')
  }
  assert.equal(db.read('alice'), undefined)
})

test('read-time cleanup preserves an active lease and strips nested non-quota fields', async () => {
  const expiresAt = Date.now() + RESERVATION_MS
  const legacy = {
    ...user(2), quota: { ...user(2).quota, secret: 'birth' },
    pendingChat: { id: 'active-request', day: shanghaiDay(), expiresAt, question: 'private question' },
  }
  const db = memoryDatabase({ alice: legacy })
  const main = handler(db, 'alice', null)
  await main({ action: 'getState' })
  const stored = db.read('alice')
  assert.equal(stored.pendingChat.id, 'active-request')
  assert.equal(stored.pendingChat.expiresAt, expiresAt)
  assert.equal(stored.quota.count, 2)
  assertQuotaOnly(stored)
})

test('upstream failures and database errors log only safe error codes', async () => {
  const db = memoryDatabase({})
  const main = handler(db, 'alice', () => { throw new Error('PRIVATE QUESTION provider details') })
  const logged = []
  const original = console.error
  console.error = (...args) => logged.push(args.join(' '))
  try {
    assert.equal((await main(chatEvent('PRIVATE QUESTION'))).code, 'AI_UNAVAILABLE')
    const broken = handler({ runTransaction: () => { throw new Error('PRIVATE DATABASE CONTENT') } }, 'alice', null)
    const result = await broken({ action: 'getState' })
    assert.equal(result.code, 'SERVER_ERROR')
    assert.equal(JSON.stringify(result).includes('PRIVATE'), false)
  } finally {
    console.error = original
  }
  assert.deepEqual(logged, ['ziwei-mini AI_UNAVAILABLE', 'ziwei-mini SERVER_ERROR'])
  assertQuotaOnly(db.read('alice'))
})
