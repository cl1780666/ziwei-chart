const { createHmac, timingSafeEqual } = require('node:crypto')
const { createServer } = require('node:http')

const MAX_BODY_BYTES = 120_000
const DEFAULT_DAILY_LIMIT = 5
const BURST_LIMIT = 4
const BURST_WINDOW_MS = 60_000
const TOKENHUB_RESPONSES_URL = 'https://tokenhub.tencentmaas.com/v1/responses'
const KLINE_TEXT_FORMAT = {
  format: {
    type: 'json_schema',
    name: 'lifetime_curve_v3',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        decades: {
          type: 'array', minItems: 10, maxItems: 10,
          items: {
            type: 'object',
            properties: {
              startAge: { type: 'integer', enum: [1, 11, 21, 31, 41, 51, 61, 71, 81, 91] },
              rows: {
                type: 'array', minItems: 10, maxItems: 10,
                items: {
                  type: 'array', minItems: 7, maxItems: 7,
                  items: { type: 'integer', minimum: 0, maximum: 100 },
                },
              },
            },
            required: ['startAge', 'rows'],
            additionalProperties: false,
          },
        },
      },
      required: ['decades'],
      additionalProperties: false,
    },
  },
}
const burstRequests = new Map()

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  })
  response.end(JSON.stringify(body))
}

function dailyLimit() {
  const parsed = Number(process.env.AI_DAILY_LIMIT)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_LIMIT
}

function currentUtcDay(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function secondsUntilNextUtcDay(date = new Date()) {
  const nextDay = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  )
  return Math.max(1, Math.ceil((nextDay - date.getTime()) / 1000))
}

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function encodeQuota(quota, secret) {
  const payload = `${quota.day}.${quota.count}`
  return `${payload}.${signature(payload, secret)}`
}

function decodeQuota(value, secret, date = new Date()) {
  const today = currentUtcDay(date)
  if (!value) return { day: today, count: 0 }

  const parts = value.split('.')
  if (parts.length !== 3) return { day: today, count: 0 }

  const [day, rawCount, providedSignature] = parts
  const count = Number(rawCount)
  if (!day || !providedSignature || !Number.isInteger(count) || count < 0) {
    return { day: today, count: 0 }
  }

  const payload = `${day}.${count}`
  const expected = Buffer.from(signature(payload, secret))
  const provided = Buffer.from(providedSignature)
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return { day: today, count: 0 }
  }

  return day === today ? { day, count } : { day: today, count: 0 }
}

function quotaCookie(quota, secret, date = new Date()) {
  return [
    `ziwei_ai_quota=${encodeQuota(quota, secret)}`,
    'Path=/api/chat',
    `Max-Age=${secondsUntilNextUtcDay(date)}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ')
}

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return undefined

  for (const cookie of cookieHeader.split(';')) {
    const [key, ...valueParts] = cookie.trim().split('=')
    if (key === name) return valueParts.join('=')
  }
  return undefined
}

function clientIp(request) {
  const forwarded = request.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() || 'unknown'
  if (Array.isArray(forwarded)) return forwarded[0] || 'unknown'
  return request.socket.remoteAddress || 'unknown'
}

function passesBurstLimit(ip, now = Date.now()) {
  const recent = (burstRequests.get(ip) || []).filter(
    (timestamp) => now - timestamp < BURST_WINDOW_MS,
  )
  if (recent.length >= BURST_LIMIT) {
    burstRequests.set(ip, recent)
    return false
  }

  recent.push(now)
  burstRequests.set(ip, recent)

  if (burstRequests.size > 2_000) {
    for (const [key, timestamps] of burstRequests) {
      if (timestamps.every((timestamp) => now - timestamp >= BURST_WINDOW_MS)) {
        burstRequests.delete(key)
      }
    }
  }
  return true
}

function sameOrigin(request) {
  const origin = request.headers.origin
  const host = request.headers.host
  if (!origin || !host) return true

  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

async function parseBody(request) {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new Error('REQUEST_TOO_LARGE')
    chunks.push(buffer)
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function validateMessages(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null

  const messages = []
  let totalLength = 0
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const { role, content } = item
    if (!['system', 'user', 'assistant'].includes(String(role))) return null
    if (typeof content !== 'string' || content.length < 1 || content.length > 60_000) {
      return null
    }
    totalLength += content.length
    if (totalLength > 90_000) return null
    messages.push({ role, content })
  }
  return messages
}

async function handleChat(request, response) {
  if (!sameOrigin(request)) {
    sendJson(response, 403, { error: '请求来源无效' })
    return
  }

  const apiKey = process.env.TOKENHUB_API_KEY
  const quotaSecret = process.env.RATE_LIMIT_SECRET
  if (!apiKey || !quotaSecret) {
    sendJson(response, 503, { error: 'AI 服务尚未完成配置，请稍后再试' })
    return
  }

  if (!passesBurstLimit(clientIp(request))) {
    sendJson(response, 429, { error: '请求太频繁，请一分钟后再试' }, { 'Retry-After': '60' })
    return
  }

  const limit = dailyLimit()
  const quotaValue = readCookie(request.headers.cookie, 'ziwei_ai_quota')
  const quota = decodeQuota(quotaValue, quotaSecret)
  if (quota.count >= limit) {
    const retryAfter = secondsUntilNextUtcDay()
    sendJson(
      response,
      429,
      { error: `今天的 ${limit} 次共享 AI 已用完，请明天再来` },
      {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
      },
    )
    return
  }

  let body
  try {
    body = await parseBody(request)
  } catch (error) {
    const message = error instanceof Error && error.message === 'REQUEST_TOO_LARGE'
      ? '请求内容过长'
      : '请求内容格式不正确'
    sendJson(response, 400, { error: message })
    return
  }

  const messages = validateMessages(body?.messages)
  if (!messages) {
    sendJson(response, 400, { error: '消息内容不正确或过长' })
    return
  }
  // A fixed output profile for the full 100-year curve. Never accept caller
  // model, reasoning or token-budget options; ordinary reports stay unchanged.
  const klineMode = body.analysisMode === 'kline'

  const abortController = new AbortController()
  response.on('close', () => {
    if (!response.writableEnded) abortController.abort()
  })

  let upstream
  try {
    upstream = await fetch(TOKENHUB_RESPONSES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.TOKENHUB_MODEL || 'deepseek-v4-flash-202605',
        input: messages.map((message) => ({
          role: message.role === 'system' ? 'developer' : message.role,
          content: message.content,
        })),
        reasoning: { effort: klineMode ? 'none' : 'low' },
        max_output_tokens: klineMode ? 6_000 : 3_000,
        ...(klineMode ? { text: KLINE_TEXT_FORMAT } : {}),
        stream: true,
      }),
      signal: abortController.signal,
    })
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.error('TOKENHUB_CONNECTION_FAILED')
    }
    if (!response.headersSent) {
      sendJson(response, 502, { error: '暂时无法连接 AI 服务，请稍后再试' })
    }
    return
  }

  if (!upstream.ok || !upstream.body) {
    // Provider errors may echo the submitted messages. Never read them into logs.
    await upstream.body?.cancel().catch(() => {})
    console.error('TOKENHUB_API_FAILED', upstream.status)

    const errorMessage = upstream.status === 402
      ? '共享 AI 的免费额度暂时用完了，请稍后再试'
      : upstream.status === 429
        ? 'AI 服务当前请求较多，请稍后再试'
        : 'AI 服务暂时不可用，请稍后重试'
    sendJson(response, 502, { error: errorMessage })
    return
  }

  const nextCount = quota.count + 1
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(0, limit - nextCount)),
    'Set-Cookie': quotaCookie({ day: quota.day, count: nextCount }, quotaSecret),
  })

  const reader = upstream.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      response.write(Buffer.from(value))
    }
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.error('TOKENHUB_STREAM_FAILED')
    }
  } finally {
    reader.releaseLock()
    if (!response.writableEnded) response.end()
  }
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname

  if (request.method === 'GET' && (pathname === '/' || pathname === '/health')) {
    sendJson(response, 200, {
      ok: true,
      provider: 'Tencent TokenHub',
      model: process.env.TOKENHUB_MODEL || 'deepseek-v4-flash-202605',
    })
    return
  }

  if (request.method === 'POST' && (pathname === '/' || pathname === '/api/chat')) {
    await handleChat(request, response)
    return
  }

  if (request.method !== 'POST') response.setHeader('Allow', 'GET, POST')
  sendJson(response, 404, { error: '接口不存在' })
})

server.listen(9000, '0.0.0.0', () => {
  console.log('Ziwei AI HTTP function listening on port 9000')
})
