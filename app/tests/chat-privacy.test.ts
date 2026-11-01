import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../api/chat'

const privateText = '出生资料2002-08-19 安徽；问题与聊天回答只留在本机'
let requestNumber = 0

function request() {
  requestNumber += 1
  return {
    method: 'POST',
    headers: { host: 'localhost' },
    socket: { remoteAddress: `127.0.0.${requestNumber}` },
    body: { messages: [{ role: 'user', content: privateText }] },
  } as IncomingMessage & { body: unknown }
}

function response() {
  const writeHead = vi.fn()
  const write = vi.fn()
  const end = vi.fn()
  return {
    writeHead,
    write,
    end,
    serverResponse: { writeHead, write, end } as unknown as ServerResponse,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('legacy Vercel shared AI privacy', () => {
  it.each([402, 429, 503])('discards echoed provider error bodies for HTTP %i', async (status) => {
    vi.stubEnv('TOKENHUB_API_KEY', 'test-key')
    vi.stubEnv('RATE_LIMIT_SECRET', 'test-secret')
    const upstream = new Response(privateText, { status })
    const readBody = vi.spyOn(upstream, 'text')
    const cancelBody = vi.spyOn(upstream.body!, 'cancel')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream))
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const outgoing = response()

    await handler(request(), outgoing.serverResponse)

    expect(errorLog.mock.calls).toEqual([['TOKENHUB_API_FAILED', status]])
    expect(readBody).not.toHaveBeenCalled()
    expect(cancelBody).toHaveBeenCalledOnce()
    expect(outgoing.writeHead).toHaveBeenCalledWith(502, expect.not.objectContaining({
      'Set-Cookie': expect.anything(),
    }))
    expect(outgoing.end.mock.calls[0]?.[0]).not.toContain(privateText)
  })

  it('preserves successful streaming and the five-use cookie allowance without logging content', async () => {
    vi.stubEnv('TOKENHUB_API_KEY', 'test-key')
    vi.stubEnv('RATE_LIMIT_SECRET', 'test-secret')
    vi.stubEnv('AI_DAILY_LIMIT', '5')
    const event = `data: ${JSON.stringify({ delta: privateText })}\n\n`
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(event)))
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const outgoing = response()

    await handler(request(), outgoing.serverResponse)

    expect(errorLog).not.toHaveBeenCalled()
    expect(outgoing.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'X-RateLimit-Limit': '5',
      'X-RateLimit-Remaining': '4',
      'Set-Cookie': expect.stringMatching(/^ziwei_ai_quota=/),
    }))
    const streamed = Buffer.concat(outgoing.write.mock.calls.map(([chunk]) => chunk)).toString('utf8')
    expect(streamed).toBe(event)
    expect(outgoing.end).toHaveBeenCalledOnce()
  })
})
