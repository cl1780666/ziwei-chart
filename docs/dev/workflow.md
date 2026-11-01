# Workflow

> L2 | Parent: `AGENTS.md`

## Local Development

From `app/`:

```powershell
npm run dev
```

Use the local URL printed by Vite. If a frontend behavior changes, verify it in a
browser when practical.

Shared AI development uses server-only values:

```text
TOKENHUB_API_KEY
RATE_LIMIT_SECRET
AI_DAILY_LIMIT=5
TOKENHUB_MODEL=deepseek-v4-flash-202605
```

Never commit the environment file or expose these values through `VITE_`
variables. Vite alone does not run the CloudBase HTTP function. For local function
checks, start `cloudbase/functions/ziwei-ai/index.js`; it listens on port `9000`.

## Verification

From `app/`:

```powershell
npm run lint
npm run test
npm run build
```

For deployment mirror workflow edits:

```powershell
npm run test -- sync-zwknows
```

## Documentation Gate

Before finishing any meaningful change, update the matching development document:

- `docs/dev/progress.md` for current status, shipped work, risks, and verification.
- `docs/dev/project-map.md` for structure, module ownership, or data flow.
- `docs/dev/decisions.md` for durable product or technical choices.
- `docs/dev/workflow.md` for commands, release, GitHub, or Vercel process.
- `app/AGENTS.md` for app-level module and testing guidance.

Then check:

```powershell
git diff --stat
git status --short --branch
```

## GitHub Issue Rules

Use GitHub issue templates for incoming work:

- Bug reports must include symptom, reproduction steps, expected behavior, area,
  and documentation impact.
- Feature requests must include problem, smallest useful solution, acceptance
  criteria, area, and documentation impact.
- Development tasks must include scope, likely files or modules, verification
  plan, and documentation-as-code checklist.

Issues may start as rough notes, but implementation work should not begin until
scope, verification, and documentation impact are clear enough to execute.

## Pull Request Rules

Every PR must fill out `.github/PULL_REQUEST_TEMPLATE.md`.

The documentation-as-code checklist is part of review. A PR that changes behavior,
architecture, workflow, deployment, data sources, or development process without
matching documentation is incomplete.

For code changes, include fresh verification evidence. If a command is not run,
state the reason in the PR.

## CloudBase Release

Build the Vite app, run `cloudbase/build-static-release.mjs`, and upload the
resulting `cloudbase-release/` directory to CloudBase static website hosting.
The release script keeps the four selected licensed music files local to the
site. Package `cloudbase/functions/ziwei-ai/index.js`, `package.json`, and the
executable `scf_bootstrap` at the root of a ZIP, then deploy it as a Node.js HTTP
function. Configure the HTTP gateway with these routes on one domain:

```text
/api/chat -> ziwei-ai HTTP function
/         -> static website hosting
```

Set `TOKENHUB_API_KEY`, `TOKENHUB_MODEL`, `RATE_LIMIT_SECRET`, and
`AI_DAILY_LIMIT` only in the CloudBase function environment. The static bundle
must not contain secrets.

The production environment is `supposed-bovid-d4gcywfkh2af1db6e` in Shanghai.
The gateway domain is
`supposed-bovid-d4gcywfkh2af1db6e-1522903512.ap-shanghai.app.tcloudbase.com`.
The shared model is limited to the claimed `deepseek-v4-flash-202605` free-trial
resource; keep TokenHub pay-as-you-go disabled.

## WeChat Mini Program Release

Import `wechat-miniapp/` into WeChat DevTools with the registered Mini Program
AppID `wx7284ee2afe7ed462`, which is already stored in `project.config.json`.
Associate that public-platform account with the existing Tencent Cloud account,
then import or convert the environment `supposed-bovid-d4gcywfkh2af1db6e` in the
DevTools cloud environment manager.

Deploy `wechat-miniapp/cloudfunctions/ziwei-mini` as an event-triggered function
with cloud-side dependency installation. It expects `wx-server-sdk` 4.0.2 and
`iztro` 2.5.8. Optional environment values are:

```text
MINI_AI_DAILY_LIMIT=5
MINI_AI_MODEL=deepseek-v4.1-flash
```

Enable the selected model in CloudBase AI and confirm eligible Growth Plan or
resource-point capacity. Keep the `ziwei_mini_users` collection inaccessible to
direct client reads and writes; all access goes through the OPENID-aware cloud
function.

Local deterministic checks can run with any Node runtime that resolves the app's
installed `iztro` dependency:

```powershell
NODE_PATH=app/node_modules node --test wechat-miniapp/cloudfunctions/ziwei-mini/domain.test.js
```

Before review submission, verify profile persistence, twelve-palace rendering,
two-turn context, quota decrement, and cross-account isolation on real devices.

## Legacy GitHub Sync to Vercel Repository

Source repo: `ziweiknows/ziwei-chart`

Deployment mirror: `ruijayfeng/zwknows`

The workflow `.github/workflows/sync-zwknows.yml` runs on pushes to `main`.
It pushes source `main` to `zwknows/main` with `--force-with-lease`.

Required GitHub secret on `ziweiknows/ziwei-chart`:

```text
ZWKNOWS_SYNC_TOKEN
```

The token must have access to `ruijayfeng/zwknows` and include permissions needed
to update workflow files, currently `repo` and `workflow` for a classic PAT.

User forks may still connect Vercel directly to their own `main` branch during
the CloudBase cutover. The Vercel-compatible function now expects
`TOKENHUB_API_KEY`, `RATE_LIMIT_SECRET`, `AI_DAILY_LIMIT`, and `TOKENHUB_MODEL`.

## Sync Debugging

Check recent runs:

```powershell
gh run list --repo ziweiknows/ziwei-chart --workflow "Sync zwknows deployment repository" --limit 3 --json databaseId,status,conclusion,headSha,url
```

Inspect a run:

```powershell
gh run view <run-id> --repo ziweiknows/ziwei-chart --json status,conclusion,attempt,headSha,url
gh run view <run-id> --repo ziweiknows/ziwei-chart --log
```

Compare refs:

```powershell
git ls-remote origin refs/heads/main
git ls-remote zwknows refs/heads/main
```

Both refs should match after a successful sync.

[PROTOCOL]: Update this file when commands, CI, GitHub, Vercel, or release flow
changes.
