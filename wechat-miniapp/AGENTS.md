# WeChat Mini Program Agent Guide

> L2 | Parent: `../AGENTS.md`

## Scope

This directory contains the native WeChat Mini Program and its event-triggered
CloudBase function.

## Boundaries

- Never accept OPENID, APPID, quota count, or another user identifier from page data.
- Obtain identity only from `@cloudbase/node-sdk`'s `auth().getUserInfo()` inside
  `ziwei-mini`. Require a nonempty trusted UID and `isAnonymous === false`;
  namespace stored IDs as `uid:<uid>`. Never fall back to identity in event data.
- Keep database access inside the cloud function; pages call `utils/api.js` only.
- Persist birth profiles, chart summaries, and chat history only in account-scoped
  storage on the current device. Never return legacy cloud content or sync these
  records between devices, including devices using the same WeChat account.
- Store only quota counters, pending-request leases, and necessary timestamps in
  the cloud collection. Whitelist database fields to remove legacy personal
  content, and never log birth profiles, questions, answers, or prompt bodies.
- Keep the model call behind the cloud function so daily quota is checked before use.
- Preserve the 2002-08-19 female default and the personalized Lei welcome unless
  the product request changes them.
- Reuse the local birthplace dataset and deterministic true-solar-time logic.
- Do not add provider keys or secrets to `project.config.json`, page code, or Git.

## Verification

Run the deterministic domain tests with a Node runtime and the repository's
installed `iztro` dependency:

```powershell
NODE_PATH=app/node_modules node --test wechat-miniapp/cloudfunctions/ziwei-mini/*.test.js wechat-miniapp/tests/*.test.js
```

Before a release, also compile in WeChat DevTools and verify on two different
WeChat accounts that profiles and chats remain isolated.

## Deployment

`project.config.json` contains the registered Mini Program AppID
`wx7284ee2afe7ed462`. The paid PG environment cannot be imported through DevTools'
native environment conversion, so use the bundled JS SDK with HTTP OpenID login.
The environment's enabled identity source must match that exact Mini Program
AppID. The frontend contains no provider credentials. Deploy
`cloudfunctions/ziwei-mini` with cloud-side dependency installation through
CloudBase console or CLI, and register the platform gateway request domain.
Use the 90-second execution timeout declared in `cloudbaserc.json`; DevTools
deployments must verify the equivalent setting in the cloud console. Keep that
timeout below the store's two-minute abandoned-request recovery lease.

All quota document mutations go through `user-store.js` transactions. Reserve
quota before calling AI and keep the model outside transaction retries. The
client serializes local profile/history changes while a request is in flight.
Model requests transiently include the current device's profile and recent
conversation; never persist that content in application cloud storage.

[PROTOCOL]: Update this file when Mini Program identity, storage, deployment, or
testing boundaries change.
