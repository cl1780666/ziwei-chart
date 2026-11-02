const test = require('node:test')
const assert = require('node:assert/strict')
const { generateAnswer } = require('./ai')

const messages = [{ role: 'user', content: 'hello' }]
const frame = (value) => `data: ${JSON.stringify(value)}\r\n\r\n`

function sse(text, chunkSize = 7) {
  const bytes = new TextEncoder().encode(text)
  return new Response(new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) controller.enqueue(bytes.slice(i, i + chunkSize))
      controller.close()
    },
  }), { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } })
}

test('posts only messages to the fixed owned route and never repeats done text', async () => {
  let calls = 0
  const text = await generateAnswer(messages, { fetchImpl: async (url, options) => {
    calls += 1
    assert.equal(url, 'https://supposed-bovid-d4gcywfkh2af1db6e-1522903512.ap-shanghai.app.tcloudbase.com/api/chat')
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { messages })
    assert.equal(options.credentials, 'omit')
    assert.equal(options.headers.Cookie, undefined)
    assert.equal(options.redirect, 'error')
    return sse(frame({ type: 'response.output_text.delta', delta: '你好，' })
      + frame({ type: 'response.output_text.delta', delta: '蕾蕾' })
      + frame({ type: 'response.output_text.done', text: '你好，蕾蕾' })
      + frame({ type: 'response.completed' }), 1)
  } })
  assert.equal(text, '你好，蕾蕾')
  assert.equal(calls, 1)
})

test('supports a full-text done fallback without deltas and trailing blank line', async () => {
  const text = await generateAnswer(messages, {
    fetchImpl: async () => sse('event: response.output_text.done\ndata: {"text":"quiet answer"}'),
  })
  assert.equal(text, 'quiet answer')
})

test('only the exact server kline mode adds a fixed body flag and never forwards provider options', async () => {
  for (const analysisMode of ['kline', 'KLINE', 'kline ', 'natal', undefined, { mode: 'kline' }]) {
    await generateAnswer(messages, {
      analysisMode, max_output_tokens: 999999, reasoning: { effort: 'high' }, model: 'forged', url: 'https://invalid.example',
      fetchImpl: async (url, options) => {
        assert.equal(url, 'https://supposed-bovid-d4gcywfkh2af1db6e-1522903512.ap-shanghai.app.tcloudbase.com/api/chat')
        assert.deepEqual(JSON.parse(options.body), analysisMode === 'kline' ? { messages, analysisMode: 'kline' } : { messages })
        return sse(frame({ type: 'response.output_text.done', text: 'answer' }))
      },
    })
  }
})

test('provider error, HTTP error, and incomplete output all reject for quota refund', async () => {
  const responses = [
    new Response('{"error":"rate limited"}', { status: 429 }),
    sse(frame({ type: 'response.output_text.delta', delta: 'partial' }) + frame({ type: 'response.failed' })),
    sse(frame({ type: 'error', error: { message: 'free trial exhausted' } })),
    sse(frame({ type: 'response.output_text.delta', delta: 'interrupted' })),
    new Response('<html>gateway warning</html>', { headers: { 'content-type': 'text/html' } }),
  ]
  for (const response of responses) {
    await assert.rejects(generateAnswer(messages, { fetchImpl: async () => response }))
  }
})

test('failure diagnostics use safe fixed codes without provider text', async () => {
  const cases = [
    [new Response('PRIVATE PROVIDER BODY', { status: 429 }), 'AI_UPSTREAM'],
    [sse(frame({ type: 'response.incomplete', response: { status: 'incomplete' } })), 'AI_INCOMPLETE'],
    [sse(frame({ type: 'response.output_text.done', text: 'private partial answer' })
      + frame({ type: 'response.completed', response: { status: 'incomplete' } })), 'AI_INCOMPLETE'],
    [sse(frame({ type: 'response.output_text.delta', delta: 'private interrupted answer' })), 'AI_INCOMPLETE'],
  ]
  for (const [response, code] of cases) {
    await assert.rejects(generateAnswer(messages, { fetchImpl: async () => response }), (error) => error.code === code && error.message === code)
  }
  await assert.rejects(generateAnswer(messages, { fetchImpl: async () => { throw new Error('PRIVATE NETWORK DETAILS') } }),
    (error) => error.code === 'AI_UPSTREAM' && error.message === 'AI_UPSTREAM')
})

test('request timeout also aborts a response that stalls during streaming', async () => {
  let aborted = false
  await assert.rejects(generateAnswer(messages, {
    timeoutMs: 10,
    fetchImpl: async (_url, options) => new Response(new ReadableStream({
      start(controller) {
        options.signal.addEventListener('abort', () => {
          aborted = true
          controller.error(options.signal.reason)
        })
      },
    }), { headers: { 'content-type': 'text/event-stream' } }),
  }), (error) => error.code === 'AI_TIMEOUT' && error.message === 'AI_TIMEOUT')
  assert.equal(aborted, true)
})
