import { createHmac, timingSafeEqual } from 'node:crypto'

export interface DailyQuota {
  day: string
  count: number
}

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function currentUtcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function encodeQuota(quota: DailyQuota, secret: string): string {
  const payload = `${quota.day}.${quota.count}`
  return `${payload}.${signature(payload, secret)}`
}

export function decodeQuota(
  value: string | undefined,
  secret: string,
  date = new Date(),
): DailyQuota {
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
  const expectedSignature = signature(payload, secret)
  const expected = Buffer.from(expectedSignature)
  const provided = Buffer.from(providedSignature)
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return { day: today, count: 0 }
  }

  return day === today ? { day, count } : { day: today, count: 0 }
}

export function secondsUntilNextUtcDay(date = new Date()): number {
  const nextDay = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  )
  return Math.max(1, Math.ceil((nextDay - date.getTime()) / 1000))
}

export function quotaCookie(
  quota: DailyQuota,
  secret: string,
  date = new Date(),
): string {
  return [
    `ziwei_ai_quota=${encodeQuota(quota, secret)}`,
    'Path=/api/chat',
    `Max-Age=${secondsUntilNextUtcDay(date)}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ')
}

export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined

  for (const cookie of cookieHeader.split(';')) {
    const [key, ...valueParts] = cookie.trim().split('=')
    if (key === name) return valueParts.join('=')
  }

  return undefined
}
