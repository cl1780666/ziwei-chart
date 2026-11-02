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
    async chat({ body = {}, headers = {} } = {}) {
      const request = Readable.from([JSON.stringify({
        messages: [{ role: 'user', content: PRIVATE_TEXT }],
        ...body,
      })])
      request.method = 'POST'
      request.url = '/api/chat'
      request.headers = { host: 'localhost', ...headers }
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

function successfulUpstream() {
  let consumed = false
  return {
    ok: true,
    body: {
      getReader() {
        return {
          async read() {
            if (consumed) return { done: true }
            consumed = true
            return { done: false, value: Buffer.from('data: {"type":"response.completed"}\n\n') }
          },
          releaseLock() {},
        }
      },
    },
  }
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
  const response = await harness.chat({ body: { analysisMode: 'kline' } })
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

test('the exact curve mode selects fixed none/6000 and a server-owned ten-by-ten curve schema', async () => {
  let providerBody
  const harness = createHarness(async (_url, options) => {
    providerBody = JSON.parse(options.body)
    return successfulUpstream()
  })
  const response = await harness.chat({ body: {
    analysisMode: 'kline', max_output_tokens: 999999,
    reasoning: { effort: 'high' }, model: 'caller-selected-model',
    apiKey: 'caller-key', url: 'https://caller.example',
    text: { format: { type: 'text', name: 'caller-schema' } },
    response_format: { type: 'json_schema', schema: { type: 'string' } },
  } })
  assert.equal(response.status, 200)
  assert.equal(providerBody.max_output_tokens, 6000)
  assert.deepEqual(providerBody.reasoning, { effort: 'none' })
  assert.equal(providerBody.model, 'deepseek-v4-flash-202605')
  assert.deepEqual(Object.keys(providerBody).sort(), ['input', 'max_output_tokens', 'model', 'reasoning', 'stream', 'text'])
  const format = providerBody.text.format
  assert.equal(format.type, 'json_schema')
  assert.equal(format.name, 'lifetime_curve_v3')
  assert.equal(format.strict, true)
  const schema = format.schema
  assert.equal(schema.type, 'object')
  assert.equal(schema.additionalProperties, false)
  assert.deepEqual(schema.required, ['decades'])
  assert.deepEqual(Object.keys(schema.properties), ['decades'])
  const decades = schema.properties.decades
  assert.equal(decades.type, 'array')
  assert.equal(decades.minItems, 10)
  assert.equal(decades.maxItems, 10)
  assert.equal(decades.items.type, 'object')
  assert.deepEqual(decades.items.required, ['startAge', 'rows'])
  assert.equal(decades.items.additionalProperties, false)
  assert.deepEqual(Object.keys(decades.items.properties), ['startAge', 'rows'])
  assert.deepEqual(decades.items.properties.startAge, { type: 'integer', enum: [1, 11, 21, 31, 41, 51, 61, 71, 81, 91] })
  const rows = decades.items.properties.rows
  assert.equal(rows.type, 'array')
  assert.equal(rows.minItems, 10)
  assert.equal(rows.maxItems, 10)
  assert.equal(rows.items.type, 'array')
  assert.equal(rows.items.minItems, 7)
  assert.equal(rows.items.maxItems, 7)
  assert.deepEqual(rows.items.items, { type: 'integer', minimum: 0, maximum: 100 })
  assert.equal(providerBody.response_format, undefined)
  assert.equal(response.headers['X-RateLimit-Remaining'], '4')
  assertPrivateTextNotLogged(harness.logs)
  assert.equal(JSON.stringify(harness.logs).includes('caller-key'), false)
})

test('default and unknown modes preserve low/3000 and ignore arbitrary provider options', async () => {
  for (const analysisMode of [undefined, null, '', 'natal', 'KLINE', ' kline ', 1, true, { task: 'kline' }, ['kline']]) {
    let providerBody
    const harness = createHarness(async (_url, options) => {
      providerBody = JSON.parse(options.body)
      return successfulUpstream()
    })
    const response = await harness.chat({ body: {
      analysisMode, max_output_tokens: 999999,
      reasoning: { effort: 'none' }, model: 'caller-selected-model',
      text: { format: { type: 'json_schema', schema: { type: 'string' } } },
    } })
    assert.equal(response.status, 200)
    assert.equal(providerBody.max_output_tokens, 3000)
    assert.deepEqual(providerBody.reasoning, { effort: 'low' })
    assert.equal(providerBody.model, 'deepseek-v4-flash-202605')
    assert.equal(providerBody.analysisMode, undefined)
    assert.equal(providerBody.text, undefined)
    assertPrivateTextNotLogged(harness.logs)
  }
})

test('curve mode shares the same signed five-use website cookie quota', async () => {
  let providerCalls = 0
  const harness = createHarness(async () => { providerCalls += 1; return successfulUpstream() })
  let cookie
  for (let index = 0; index < 5; index += 1) {
    const response = await harness.chat({
      body: { analysisMode: index % 2 ? 'kline' : 'natal' },
      headers: { cookie, 'x-forwarded-for': `192.0.2.${index + 1}` },
    })
    assert.equal(response.status, 200)
    assert.equal(response.headers['X-RateLimit-Limit'], '5')
    assert.equal(response.headers['X-RateLimit-Remaining'], String(4 - index))
    cookie = response.headers['Set-Cookie']
  }
  const blocked = await harness.chat({
    body: { analysisMode: 'kline' },
    headers: { cookie, 'x-forwarded-for': '192.0.2.6' },
  })
  assert.equal(blocked.status, 429)
  assert.equal(blocked.headers['X-RateLimit-Remaining'], '0')
  assert.equal(blocked.headers['Set-Cookie'], undefined)
  assert.equal(providerCalls, 5)
  assertPrivateTextNotLogged(harness.logs)
})

test('all output modes retain the shared four-per-minute source IP burst guard', async () => {
  let providerCalls = 0
  const harness = createHarness(async () => { providerCalls += 1; return successfulUpstream() })
  for (const analysisMode of [undefined, 'kline', 'unknown', 'kline']) {
    const response = await harness.chat({ body: { analysisMode } })
    assert.equal(response.status, 200)
  }
  const blocked = await harness.chat({ body: { analysisMode: 'kline' } })
  assert.equal(blocked.status, 429)
  assert.equal(blocked.headers['Retry-After'], '60')
  assert.equal(blocked.headers['Set-Cookie'], undefined)
  assert.equal(providerCalls, 4)
  assertPrivateTextNotLogged(harness.logs)
})
