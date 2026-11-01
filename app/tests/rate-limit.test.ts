import { describe, expect, it } from 'vitest'
import {
  currentUtcDay,
  decodeQuota,
  encodeQuota,
  quotaCookie,
  readCookie,
  secondsUntilNextUtcDay,
} from '../api/rate-limit'

const secret = 'test-secret-with-enough-entropy'

describe('shared AI daily quota', () => {
  it('round-trips a signed quota for the current UTC day', () => {
    const date = new Date('2026-11-01T12:00:00Z')
    const value = encodeQuota({ day: currentUtcDay(date), count: 3 }, secret)

    expect(decodeQuota(value, secret, date)).toEqual({ day: '2026-11-01', count: 3 })
  })

  it('rejects a modified counter', () => {
    const date = new Date('2026-11-01T12:00:00Z')
    const value = encodeQuota({ day: currentUtcDay(date), count: 3 }, secret)
    const tampered = value.replace('.3.', '.0.')

    expect(decodeQuota(tampered, secret, date)).toEqual({ day: '2026-11-01', count: 0 })
  })

  it('resets a valid quota on the next UTC day', () => {
    const value = encodeQuota({ day: '2026-11-01', count: 5 }, secret)

    expect(decodeQuota(value, secret, new Date('2026-11-02T00:00:01Z'))).toEqual({
      day: '2026-11-02',
      count: 0,
    })
  })

  it('creates an http-only cookie expiring at the next UTC day', () => {
    const date = new Date('2026-11-01T23:59:30Z')
    const cookie = quotaCookie({ day: currentUtcDay(date), count: 1 }, secret, date)

    expect(secondsUntilNextUtcDay(date)).toBe(30)
    expect(cookie).toContain('Max-Age=30')
    expect(cookie).toContain('HttpOnly')
    expect(readCookie(cookie, 'ziwei_ai_quota')).toBeTruthy()
  })
})
