const test = require('node:test')
const assert = require('node:assert/strict')
const { trustedUserId } = require('./identity')

test('uses only the verified SDK UID and allows HTTP login without native WX fields', () => {
  const auth = { getUserInfo: () => ({ uid: 'real-user', isAnonymous: false, openId: '', appId: '' }) }
  assert.equal(trustedUserId(auth, { uid: 'forged-user', OPENID: 'forged-openid' }), 'uid:real-user')
})

test('rejects missing, anonymous, and ambiguous runtime authentication', () => {
  for (const identity of [null, {}, { uid: '' }, { uid: '  ', isAnonymous: false }, { uid: 'alice' }, { uid: 'alice', isAnonymous: true }]) {
    assert.equal(trustedUserId({ getUserInfo: () => identity }), null)
  }
})
