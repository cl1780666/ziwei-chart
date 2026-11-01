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
The paid environment `supposed-bovid-d4gcywfkh2af1db6e` is PostgreSQL and is not
selectable in DevTools' native environment conversion. Authorize the Mini Program
under that environment and enable the exact AppID identity source. The bundled
CloudBase JS SDK 3.10.4 uses HTTP OpenID login and authenticated `callFunction`.
Register `https://supposed-bovid-d4gcywfkh2af1db6e.api.tcloudbasegateway.com`
as a request legal domain in the Mini Program backend. Never add an AppSecret,
admin API key, or user identifier to client requests.

The production Auth/Functions client bundle is checked into `miniprogram/vendor`
so DevTools does not need to build npm. To rebuild from `wechat-miniapp/`, run
`pnpm install --ignore-scripts` and `pnpm build:sdk`. The script preserves SDK
licenses and enforces a 2 MiB maximum for the whole main package.

Deploy `wechat-miniapp/cloudfunctions/ziwei-mini` as an event-triggered function
with cloud-side dependency installation. It expects `wx-server-sdk` 4.0.2 and
`iztro` 2.5.8, plus `@cloudbase/node-sdk` 3.17.2 for trusted runtime identity.
Set the deployed execution timeout to 90 seconds in the cloud
console. For CLI deployments, run `tcb functions:deploy ziwei-mini` from
`wechat-miniapp/`; its `cloudbaserc.json` declares the event handler, Node.js
20.19 runtime, dependency installation, and 90-second timeout. This execution
timeout must remain below the two-minute pending-request lease used to recover
abandoned requests. SDK request timeout alone does not configure execution time.
Optional environment values are:

```text
MINI_AI_DAILY_LIMIT=20
```

The Mini Program backend reuses the existing website's TokenHub `/api/chat`
service through a fixed server-only URL. Keep that service and its already
configured free-trial resource available; no separate CloudBase AI activation
or Mini Program model key is needed. The adapter omits cookies, rejects redirects,
and aborts after 80 seconds. The website's existing four-per-minute IP burst
guard also applies to cloud-function egress; upstream failures refund the Mini
Program reservation. Its own default allowance is twenty questions per user
per Shanghai day, while the website browser quota remains five.

Enable `pgdoc` in the PG Document editor, create the
`ziwei_mini_users` collection, and keep it inaccessible to direct client reads
and writes. All access goes through the UID-aware cloud function, which rejects
anonymous or missing authenticated runtime identity.

This collection is quota-only: never store profiles, charts, questions, or
answers. Each phone uses account-scoped local storage for its personal content,
with no cloud import or cross-device synchronization. On upgrades from the old
cloud-history version, deploy the quota-only function first, let old in-flight
calls finish within their 90-second execution window, and remove legacy personal
fields while preserving existing quota. The new store automatically allowlists
any document it reads or writes; check the complete collection for unvisited
legacy records as well. Recompile and regenerate the device preview afterward.

Deploy the matching privacy-safe `ziwei-ai` proxy code in place, keeping its
existing server environment configuration. Proxy logs must contain only fixed
error codes and HTTP status, never provider error bodies or arbitrary exception
messages that may echo private input. Run its local mock verification with
`node --test cloudbase/functions/ziwei-ai/privacy.test.js`.

Local deterministic checks can run with any Node runtime that resolves the app's
installed `iztro` dependency:

```powershell
NODE_PATH=app/node_modules node --test wechat-miniapp/cloudfunctions/ziwei-mini/*.test.js wechat-miniapp/tests/*.test.js
```

Before review submission, verify current-device profile/chat persistence,
twelve-palace rendering, two-turn context, quota decrement, account isolation,
and that the same account on a second phone sees no personal data. Inspect the
quota collection after a successful conversation to confirm no personal fields
were recreated.

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
