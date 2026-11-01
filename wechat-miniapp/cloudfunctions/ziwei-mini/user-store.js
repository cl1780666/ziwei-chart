const { randomUUID } = require('node:crypto')
const { quotaState } = require('./domain')

const USERS = 'ziwei_mini_users'
// Longer than the configured 90-second function lifetime, so a replacement
// request cannot overlap a still-running invocation.
const RESERVATION_MS = 120000

// Every database write uses this allowlist, including reads of legacy records.
// Birth profiles, generated charts and conversation text must never survive it.
function quotaOnlyUser(user, at = new Date()) {
  if (!user) return null
  const day = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
  const count = Number(user.quota && user.quota.count)
  const pending = user.pendingChat
  const validPending = pending && typeof pending.id === 'string' && pending.id.length > 0
    && pending.id.length <= 128 && day(pending.day) && Number.isSafeInteger(pending.expiresAt)
  const timestamp = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value)
    ? value : at.toISOString()
  return {
    quota: { day: day(user.quota && user.quota.day), count: Number.isSafeInteger(count) && count >= 0 ? count : 0 },
    pendingChat: validPending ? { id: pending.id, day: pending.day, expiresAt: pending.expiresAt } : null,
    createdAt: timestamp(user.createdAt),
    updatedAt: timestamp(user.updatedAt),
  }
}

function createUserStore(db, { dailyLimit, now = () => new Date(), requestId = randomUUID } = {}) {
  function refund(user, reservation) {
    const quota = quotaState(user.quota, dailyLimit(), now())
    return {
      ...user,
      pendingChat: null,
      quota: {
        day: quota.day,
        count: Math.max(0, quota.count - (reservation.day === quota.day ? 1 : 0)),
      },
    }
  }

  async function change(openid, mutate) {
    let value
    // Only database reads/writes belong in this short transaction. The model
    // call runs after the reservation commits, outside any transaction retry.
    await db.runTransaction(async (transaction) => {
      const doc = transaction.collection(USERS).doc(openid)
      let stored
      try {
        stored = (await doc.get()).data || null
      } catch (error) {
        if (!/document .* does not exist/i.test(String(error.message || error.errMsg || error))) throw error
        stored = null
      }
      const at = now()
      let user = quotaOnlyUser(stored, at)
      if (user && user.pendingChat && user.pendingChat.expiresAt <= at.getTime()) {
        user = refund(user, user.pendingChat)
      }
      const result = mutate(user)
      value = result.value
      const next = quotaOnlyUser(result.user, at)
      const previous = stored ? { ...stored } : null
      if (previous) delete previous._id
      if (next && JSON.stringify(next) !== JSON.stringify(previous)) {
        await doc.set({ data: { ...next, updatedAt: at.toISOString() } })
      }
    })
    return value
  }

  return {
    read: (openid) => change(openid, (user) => ({ user, value: user })),
    change,

    reserve(openid) {
      const id = requestId()
      return change(openid, (user) => {
        if (user && user.pendingChat) return { user, value: { code: 'CHAT_IN_PROGRESS' } }
        const quota = quotaState(user && user.quota, dailyLimit(), now())
        if (quota.remaining <= 0) return { user, value: { code: 'DAILY_LIMIT', quota } }
        const pendingChat = { id, day: quota.day, expiresAt: now().getTime() + RESERVATION_MS }
        const next = { ...user, pendingChat, quota: { day: quota.day, count: quota.count + 1 } }
        return { user: next, value: { id } }
      })
    },

    finish(openid, id) {
      return change(openid, (user) => {
        if (!user || !user.pendingChat || user.pendingChat.id !== id) {
          return { user, value: null }
        }
        const next = { ...user, pendingChat: null }
        return { user: next, value: next }
      })
    },

    release(openid, id) {
      return change(openid, (user) => {
        const next = user && user.pendingChat && user.pendingChat.id === id
          ? refund(user, user.pendingChat)
          : user
        return { user: next, value: next }
      })
    },
  }
}

module.exports = { createUserStore, quotaOnlyUser, RESERVATION_MS }
