const CHAT_URL = 'https://supposed-bovid-d4gcywfkh2af1db6e-1522903512.ap-shanghai.app.tcloudbase.com/api/chat'
const REQUEST_TIMEOUT_MS = 80000

async function readAnswer(body) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let deltas = ''
  const completedTexts = []
  let completed = false

  function event(frame) {
    let eventName = ''
    const data = []
    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
    }
    if (!data.length) return
    const raw = data.join('\n')
    if (raw === '[DONE]') { completed = true; return }
    const value = JSON.parse(raw)
    const type = value.type || eventName
    if (type === 'error' || type === 'response.failed' || type === 'response.incomplete' || value.error) {
      throw new Error('AI provider returned an error')
    }
    if (type === 'response.output_text.delta' && typeof value.delta === 'string') deltas += value.delta
    if (type === 'response.output_text.done' && typeof value.text === 'string') {
      completedTexts.push(value.text)
      completed = true
    }
    if (type === 'response.completed') completed = true
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      const frames = buffer.split(/\r?\n\r?\n/)
      buffer = frames.pop()
      for (const frame of frames) event(frame)
      if (done) break
    }
    if (buffer.trim()) event(buffer)
    // The done event repeats the full text. Use it only when no deltas arrived.
    const answer = (deltas || completedTexts.join('')).trim()
    if (!completed || !answer) throw new Error('AI response was empty or interrupted')
    return answer
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
}

async function generateAnswer(messages, { fetchImpl = fetch, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('AI request timed out')), timeoutMs)
  try {
    const response = await fetchImpl(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ messages }),
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`AI upstream request failed (${response.status})`)
    if (!response.body || !/text\/event-stream/i.test(response.headers.get('content-type') || '')) {
      throw new Error('AI upstream returned an invalid response')
    }
    return await readAnswer(response.body)
  } finally {
    clearTimeout(timer)
  }
}

module.exports = { generateAnswer }
