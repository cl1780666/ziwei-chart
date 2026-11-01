const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { readFileSync } = require('node:fs')
const { Readable } = require('node:stream')
const test = require('node:test')
const vm = require('node:vm')

const source = readFileSync(require.resolve('./index.js'), 'utf8')
const PRIVATE_TEXT = '出生资料2002-08-19 安徽；用户问题和聊天回答：只留在本机'

function createHarness(fetchMock) {
  const logs = []
  let handler
  vm.runInNewContext(source, {
    require(name) {
      if (name === 'node:http') {
        return {
          createServer(callback) {
            handler = callback
            return { listen(_port, _host, callback) { callback() } }
          },
        }
      }
      return require(name)
    },
    process: { env: { TOKENHUB_API_KEY: 'test-key', RATE_LIMIT_SECRET: 'test-secret' } },
    Buffer,
    URL,
    AbortController,
    fetch: fetchMock,
    console: {
      log: (...args) => logs.push(args),
      error: (...args) => logs.push(args),
    },
  })

  return {
    logs,
    async chat() {
      const request = Readable.from([JSON.stringify({
        messages: [{ role: 'user', content: PRIVATE_TEXT }],
      })])
      request.method = 'POST'
      request.url = '/api/chat'
      request.headers = { host: 'localhost' }
      request.socket = { remoteAddress: '127.0.0.1' }
      const response = new EventEmitter()
      response.headers = {}
      response.chunks = []
      response.headersSent = false
      response.writableEnded = false
      response.writeHead = (status, headers) => {
        response.status = status
        Object.assign(response.headers, headers)
        response.headersSent = true
      }
      response.write = (chunk) => response.chunks.push(Buffer.from(chunk))
      response.end = (chunk) => {
        if (chunk) response.write(chunk)
        response.writableEnded = true
      }
      await handler(request, response)
      response.body = Buffer.concat(response.chunks).toString('utf8')
      return response
    },
  }
}

function assertPrivateTextNotLogged(logs) {
  const output = JSON.stringify(logs)
  assert.equal(output.includes(PRIVATE_TEXT), false)
  assert.equal(output.includes('test-key'), false)
  assert.equal(output.includes('test-secret'), false)
}

test('connection errors log only a fixed code even when the error echoes input', async () => {
  const harness = createHarness(async () => { throw new Error(PRIVATE_TEXT) })
  const response = await harness.chat()
  assert.equal(response.status, 502)
  assert.equal(response.headers['Set-Cookie'], undefined)
  assertPrivateTextNotLogged(harness.logs)
  assert.equal(JSON.stringify(harness.logs.at(-1)), '["TOKENHUB_CONNECTION_FAILED"]')
})

test('provider errors discard echoed request bodies and log only code and status', async () => {
  let cancelled = false
  let bodyRead = false
  const harness = createHarness(async () => ({
    ok: false,
    status: 429,
    body: { async cancel() { cancelled = true } },
    async text() { bodyRead = true; return PRIVATE_TEXT },
  }))
  const response = await harness.chat()
  assert.equal(response.status, 502)
  assert.equal(response.headers['Set-Cookie'], undefined)
  assert.equal(cancelled, true)
  assert.equal(bodyRead, false)
  assertPrivateTextNotLogged(harness.logs)
  assert.equal(JSON.stringify(harness.logs.at(-1)), '["TOKENHUB_API_FAILED",429]')
  assert.match(response.body, /AI 服务当前请求较多/)
})

test('stream errors cannot write echoed answers or prompts into server logs', async () => {
  let released = false
  const harness = createHarness(async () => ({
    ok: true,
    body: {
      getReader() {
        return {
          async read() { throw new Error(PRIVATE_TEXT) },
          releaseLock() { released = true },
        }
      },
    },
  }))
  const response = await harness.chat()
  assert.equal(response.status, 200)
  assert.equal(response.writableEnded, true)
  assert.equal(released, true)
  assertPrivateTextNotLogged(harness.logs)
  assert.equal(JSON.stringify(harness.logs.at(-1)), '["TOKENHUB_STREAM_FAILED"]')
})

test('successful messages still stream and consume the existing cookie quota without logging content', async () => {
  const event = `data: ${JSON.stringify({ delta: PRIVATE_TEXT })}\n\n`
  let sentInput
  const harness = createHarness(async (_url, options) => {
    sentInput = JSON.parse(options.body).input
    let consumed = false
    return {
      ok: true,
      body: {
        getReader() {
          return {
            async read() {
              if (consumed) return { done: true }
              consumed = true
              return { done: false, value: Buffer.from(event) }
            },
            releaseLock() {},
          }
        },
      },
    }
  })
  const response = await harness.chat()
  assert.deepEqual(sentInput, [{ role: 'user', content: PRIVATE_TEXT }])
  assert.equal(response.status, 200)
  assert.equal(response.body, event)
  assert.equal(response.headers['X-RateLimit-Limit'], '5')
  assert.equal(response.headers['X-RateLimit-Remaining'], '4')
  assert.match(response.headers['Set-Cookie'], /^ziwei_ai_quota=/)
  assertPrivateTextNotLogged(harness.logs)
  assert.equal(harness.logs.length, 1)
})
