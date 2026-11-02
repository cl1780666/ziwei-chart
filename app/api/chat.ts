import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  decodeQuota,
  quotaCookie,
  readCookie,
  secondsUntilNextUtcDay,
} from './rate-limit.js'

type MessageRole = 'system' | 'user' | 'assistant'

interface ChatMessage {
  role: MessageRole
  content: string
}

interface ChatRequest extends IncomingMessage {
  body?: unknown
}

const MAX_BODY_BYTES = 120_000
const DEFAULT_DAILY_LIMIT = 5
const BURST_LIMIT = 4
const BURST_WINDOW_MS = 60_000
const burstRequests = new Map<string, number[]>()

function sendJson(
  response: ServerResponse,
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  })
  response.end(JSON.stringify(body))
}

function dailyLimit(): number {
  const parsed = Number(process.env.AI_DAILY_LIMIT)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_LIMIT
}

function clientIp(request: IncomingMessage): string {
  const forwarded = request.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() || 'unknown'
  if (Array.isArray(forwarded)) return forwarded[0] || 'unknown'
  return request.socket.remoteAddress || 'unknown'
}

function passesBurstLimit(ip: string, now = Date.now()): boolean {
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

function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin
  const host = request.headers.host
  if (!origin || !host) return true

  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

async function parseBody(request: ChatRequest): Promise<unknown> {
  if (request.body !== undefined) return request.body

  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new Error('REQUEST_TOO_LARGE')
    chunks.push(buffer)
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function validateMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null

  const messages: ChatMessage[] = []
  let totalLength = 0
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const role = Reflect.get(item, 'role')
    const content = Reflect.get(item, 'content')
    if (!['system', 'user', 'assistant'].includes(String(role))) return null
    if (typeof content !== 'string' || content.length < 1 || content.length > 60_000) return null
    totalLength += content.length
    if (totalLength > 90_000) return null
    messages.push({ role: role as MessageRole, content })
  }

  return messages
}

export default async function handler(request: ChatRequest, response: ServerResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    sendJson(response, 405, { error: '只支持 POST 请求' })
    return
  }

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
    sendJson(
      response,
      429,
      { error: '请求太频繁，请一分钟后再试' },
      { 'Retry-After': '60' },
    )
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

  let body: unknown
  try {
    body = await parseBody(request)
  } catch (error) {
    const message = error instanceof Error && error.message === 'REQUEST_TOO_LARGE'
      ? '请求内容过长'
      : '请求内容格式不正确'
    sendJson(response, 400, { error: message })
    return
  }

  const messages = validateMessages(
    body && typeof body === 'object' ? Reflect.get(body, 'messages') : undefined,
  )
  if (!messages) {
    sendJson(response, 400, { error: '消息内容不正确或过长' })
    return
  }

  let upstream: Response
  try {
    upstream = await fetch('https://tokenhub.tencentmaas.com/v1/responses', {
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
        reasoning: { effort: 'low' },
        max_output_tokens: 3_000,
        stream: true,
      }),
    })
  } catch {
    sendJson(response, 502, { error: '暂时无法连接 AI 服务，请稍后再试' })
    return
  }

  if (!upstream.ok || !upstream.body) {
    // Provider errors may echo private messages; discard them without logging.
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
  } finally {
    reader.releaseLock()
    response.end()
  }
}
