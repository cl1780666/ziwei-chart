function trustedUserId(auth) {
  // This SDK method reads the verified invocation context, never event data.
  // HTTP SDK login supplies a CloudBase UID even without native WX_OPENID.
  const identity = auth.getUserInfo()
  if (!identity || typeof identity.uid !== 'string' || !identity.uid.trim() || identity.isAnonymous !== false) {
    return null
  }
  return `uid:${identity.uid}`
}

module.exports = { trustedUserId }
