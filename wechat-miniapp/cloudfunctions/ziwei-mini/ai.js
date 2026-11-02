const CHAT_URL = 'https://supposed-bovid-d4gcywfkh2af1db6e-1522903512.ap-shanghai.app.tcloudbase.com/api/chat'
const REQUEST_TIMEOUT_MS = 80000
const AI_ERROR_CODES = new Set(['AI_INCOMPLETE', 'AI_TIMEOUT', 'AI_UPSTREAM'])

function aiError(code) {
  return Object.assign(new Error(code), { code })
}

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
    let value
    try { value = JSON.parse(raw) } catch { throw aiError('AI_INCOMPLETE') }
    const type = value.type || eventName
    if (type === 'response.incomplete' || value.response && value.response.status === 'incomplete') {
      throw aiError('AI_INCOMPLETE')
    }
    if (type === 'error' || type === 'response.failed' || value.error) {
      throw aiError('AI_UPSTREAM')
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
    if (!completed || !answer) throw aiError('AI_INCOMPLETE')
    return answer
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw AI_ERROR_CODES.has(error && error.code) ? error : aiError('AI_UPSTREAM')
  } finally {
    reader.releaseLock()
  }
}

async function generateAnswer(messages, { fetchImpl = fetch, timeoutMs = REQUEST_TIMEOUT_MS, analysisMode } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(aiError('AI_TIMEOUT')), timeoutMs)
  try {
    const response = await fetchImpl(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ messages, ...(analysisMode === 'kline' ? { analysisMode: 'kline' } : {}) }),
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    })
    if (!response.ok) throw aiError('AI_UPSTREAM')
    if (!response.body || !/text\/event-stream/i.test(response.headers.get('content-type') || '')) {
      throw aiError('AI_UPSTREAM')
    }
    return await readAnswer(response.body)
  } catch (error) {
    if (controller.signal.aborted) throw aiError('AI_TIMEOUT')
    throw AI_ERROR_CODES.has(error && error.code) ? error : aiError('AI_UPSTREAM')
  } finally {
    clearTimeout(timer)
  }
}

module.exports = { generateAnswer }
