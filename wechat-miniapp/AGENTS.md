# WeChat Mini Program Agent Guide

> L2 | Parent: `../AGENTS.md`

## Scope

This directory contains the native WeChat Mini Program and its event-triggered
CloudBase function.

## Boundaries

- Never accept OPENID, APPID, quota count, or another user identifier from page data.
- Obtain identity only from `cloud.getWXContext()` inside `ziwei-mini`.
- Keep database access inside the cloud function; pages call `utils/api.js` only.
- Keep the model call behind the cloud function so daily quota is checked before use.
- Preserve the 2002-08-19 female default and the personalized Lei welcome unless
  the product request changes them.
- Reuse the local birthplace dataset and deterministic true-solar-time logic.
- Do not add provider keys or secrets to `project.config.json`, page code, or Git.

## Verification

Run the deterministic domain tests with a Node runtime and the repository's
installed `iztro` dependency:

```powershell
NODE_PATH=app/node_modules node --test wechat-miniapp/cloudfunctions/ziwei-mini/domain.test.js
```

Before a release, also compile in WeChat DevTools and verify on two different
WeChat accounts that profiles and chats remain isolated.

## Deployment

`project.config.json` contains the registered Mini Program AppID
`wx7284ee2afe7ed462`. Public-platform account association and CloudBase environment
import are still required before preview or deployment. Deploy
`cloudfunctions/ziwei-mini` with cloud-side dependency installation.

[PROTOCOL]: Update this file when Mini Program identity, storage, deployment, or
testing boundaries change.
