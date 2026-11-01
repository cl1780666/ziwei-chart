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
  }), /timed out/)
  assert.equal(aborted, true)
})
