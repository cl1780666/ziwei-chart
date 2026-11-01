# Development Progress

> L2 | Parent: `AGENTS.md`

## Current State

- Branch: `codex/wechat-miniapp`
- Source repository: `ziweiknows/ziwei-chart`
- Deployment mirror: `ruijayfeng/zwknows`
- Public hosting migration target: Tencent CloudBase
- Source-to-mirror sync verified through: `eb76a165dac652e24ac674d322386e7447a3acf0`
- Working tree was clean before this documentation task.

## Recently Completed

- Reworked the Mini Program visual system into a vertical editorial poster for
  Lei: an original violin and Wannan landscape hero, Hui-style white walls and
  dark roofs, rice-paper texture, ink green, walnut, and restrained burgundy.
  The profile, chart, and chat pages now share this palette and typography, and
  `wechat-miniapp/design-preview/` provides a browser-reviewable mobile mock.
- Added two Wannan/violin contrast quotes and retained random non-repeating
  selection. The Mini Program now has fourteen welcome quotes.
- Added a native WeChat Mini Program under `wechat-miniapp/` with the personalized
  Lei welcome, randomized contrast quotes, a 2002-08-19 female default profile,
  local birthplace matching, true-solar-time correction, twelve-palace summaries,
  and chart-grounded multi-turn chat.
- Added the event-triggered `ziwei-mini` cloud function. It uses trusted WeChat
  OPENID identity, stores each user's profile, compact chat history, and five-use
  daily quota in CloudBase, and calls the mainland `deepseek-v4.1-flash` model
  through CloudBase AI without shipping a provider key to the client.
- Added focused Node tests for profile validation, true-solar-time correction,
  chart serialization, and Shanghai-day quota rollover. All four tests pass.
  Every Mini Program JavaScript and JSON file passes syntax parsing, and all WXML
  and WXSS files pass the official compilers bundled with WeChat DevTools
  2.02.2609240.
- Added chart-grounded multi-turn chat below the natal interpretation. Visitors
  can ask a specific question directly or continue after the full report; recent
  exchanges remain available while the current chart is open, and each shared
  request uses the existing daily allowance.
- Changed the birth form defaults to 2002-08-19 and female for the personalized
  Lei flow.
- Added twelve playful contrast quotes to the Lei welcome screen. A quote is
  chosen on every page load and the previous quote is excluded from the next
  draw so consecutive opens always differ. The later Wannan visual pass expanded
  this set to fourteen.
- Prepared a CloudBase static-hosting release path and a dependency-free Node.js
  HTTP function that listens on port 9000, streams Tencent TokenHub Responses API
  events, and keeps the model key on the server.
- Removed the Vercel Analytics runtime injection from the CloudBase-targeted app
  so the public build does not request Vercel-only endpoints.
- Switched the shared provider contract from OpenAI to mainland TokenHub with a
  configurable `deepseek-v4-flash-202605` default. The five-request signed browser quota
  and four-request-per-minute IP burst limit remain in place.
- Created the Shanghai CloudBase environment
  `supposed-bovid-d4gcywfkh2af1db6e`, uploaded the static release, deployed the
  `ziwei-ai` HTTP function, and prepared disabled `/` and `/api/chat` routes on
  the default gateway domain.
- Claimed the `deepseek-v4-flash-202605` TokenHub free-trial resource with 100%
  remaining through 2027-11-01. Token-based pay-as-you-go remains disabled.
- Completed the CloudBase cutover at
  `supposed-bovid-d4gcywfkh2af1db6e-1522903512.ap-shanghai.app.tcloudbase.com`.
  The `/` static route and `/api/chat` HTTP-function route are enabled behind the
  same gateway domain. The dedicated TokenHub key is restricted to the selected
  model, has a one-token daily paid-usage ceiling, and was rotated after setup.

- Personalized the public experience for Lei with a full-screen
  "欢迎蕾蕾大王" entrance, a playful pink-violet theme, an original inline
  violin illustration, floating musical notes, and concise `For Lei · 0819`
  branding.
- Replaced the short Spotify preview with a four-track quiet romantic Bossa Nova
  playlist licensed through Pixabay. Playback starts from the welcome screen,
  advances automatically, provides one play/pause control, and loops the full playlist.
- Adjusted navigation breakpoints so the personalized header remains readable on
  tablet-width screens and uses the bottom navigation until desktop width.
- Added a server-managed AI path for visitors who do not provide a personal
  model key. The API key stays in server environment variables and never enters
  the browser bundle.
- Fixed the Vercel Node ESM function import so `/api/chat` resolves the compiled
  quota helper at runtime.
- Added a signed per-browser daily quota of five shared AI requests and a
  best-effort same-IP burst limit of four requests per minute. Personal API
  keys continue to use the existing provider adapters without consuming the
  shared quota.
- Updated natal interpretation, yearly fortune, compatibility, and life K-line
  flows to use the shared service automatically when no personal key is saved.
- Replaced the prefixed LICENSE layout with the unmodified canonical GNU GPLv3
  text so GitHub can identify the repository license; the project copyright and
  GPLv3-or-later notice remain explicit in README.
- Added a compact README repository-identity section with the canonical GitHub
  URL and facts verified from `app/package.json` and the application source.
- Added visible GitHub repository and MIT License links to the app shell.
- Added true solar time correction support.
- Added free-text birthplace matching.
- Added local city and region coordinate dataset from `88250/city-geo`.
- Added Vercel Analytics.
- Added GitHub Actions workflow to sync `ziwei/main` to `zwknows/main`.
- Added workflow validation test for `sync-zwknows.yml`.
- Fixed sync workflow credential persistence by setting `persist-credentials: false`.
- Confirmed workflow succeeds with a classic PAT stored as `ZWKNOWS_SYNC_TOKEN`.

## Organization Migration

The Chart source repository moved to `ziweiknows/ziwei-chart`; Ziwei Chat and
ZATI moved to `ziweiknows/ziwei-chat` and `ziweiknows/zati`. GitHub preserved
the repositories' public visibility, history, community assets, workflows, and
the Chart `ZWKNOWS_SYNC_TOKEN` secret. The post-transfer source-to-mirror sync
completed successfully at `8922cc2d738334e5d7bb6ee6f43f105870728c8b`.

## Known Verification Baseline

Previously passed:

```powershell
cd app
npm run lint
npm run test
npm run build
npm run test -- sync-zwknows
```

Reverified on 2026-07-31 after the LICENSE/README evidence update:

- ESLint passed.
- Vitest passed 28/28 application tests.
- The sync workflow test passed 2/2 tests.
- The TypeScript and Vite production build completed successfully.
- The local LICENSE matches GitHub's canonical GPL-3.0 template after trimming
  leading and trailing whitespace.

Known build note: Vite may report a large chunk warning. That warning was already
known and is not by itself a failure.

Reverified on 2026-11-01 after the shared AI and rate-limit change:

- ESLint passed.
- Vitest passed 32/32 tests, including signed quota tamper and rollover coverage.
- TypeScript and the Vite production build completed successfully.

Reverified on 2026-11-01 after the Mini Program Wannan poster redesign:

- The deterministic Mini Program domain tests passed 4/4.
- Every Mini Program JavaScript file passed `node --check`.
- All WXML and WXSS compiled with the official WCC/WCSC binaries bundled with
  WeChat DevTools 2.02.2609240.
- The browser design preview rendered at a phone-width 9:16 composition with the
  title, quote panel, CTA, violin, Wannan landscape, and Hui architecture visible.

Live CloudBase verification on 2026-11-01:

- Rebuilt and uploaded the static release after the conversation and welcome
  updates. The public site showed 2002-08-19 and female in the birth form,
  changed the welcome quote across consecutive reloads, and rendered the new
  chat panel.
- Completed a two-turn public conversation about career direction. Both answers
  streamed from the shared TokenHub route and the second answer used the prior
  exchange as conversation context.
- ESLint passed, Vitest passed 32/32 tests, and the TypeScript/Vite production
  build completed successfully after the final TokenHub model update.
- The public welcome screen rendered with the personalized copy and violin theme.
- The local Bossa Nova track played from CloudBase static hosting and reported a
  2:43 duration.
- `GET /api/chat` returned the TokenHub provider and
  `deepseek-v4-flash-202605` model health metadata.
- `POST /api/chat` returned HTTP 200, streamed `response.output_text.delta`
  events, set the signed quota cookie, and reported four of five daily requests
  remaining for the test browser.

## Open Risks

- The Mini Program cannot be previewed or deployed until a real Mini Program
  AppID is registered, associated with the CloudBase environment, and imported
  into WeChat DevTools. The repository currently uses `touristappid` only as an
  import placeholder.
- The existing environment was created from the Tencent Cloud side. Its account
  must be associated with the WeChat public-platform account before the Mini
  Program can use OPENID cloud calls and the event function.
- `CLAUDE.md` currently reads as mojibake in this environment and should not be
  treated as the primary agent entry point.
- The birthplace matching experience depends on the quality and coverage of the
  local coordinate dataset.
- The deployment mirror sync depends on the GitHub secret `ZWKNOWS_SYNC_TOKEN`
  retaining both `repo` and `workflow` permissions.
- The signed cookie quota prevents casual overuse. A visitor can reset a browser
  cookie, so strict cross-device or global quotas require durable server storage.
- The default CloudBase testing domain displays a three-second first-visit
  warning. Removing it requires a suitable custom domain and the applicable
  mainland China domain/ICP setup.
- `npm ci` currently reports 11 dependency audit findings (1 low, 2 moderate,
  8 high); remediation needs a separately scoped dependency review because this
  documentation/license change does not alter the lockfile.

## Next Useful Work

- Associate the Mini Program AppID with the CloudBase environment, deploy
  `ziwei-mini` with cloud-side dependency installation, and run a two-account
  device test before submitting the Mini Program for review.
- Bind a custom domain when one is available so visitors no longer see the
  CloudBase test-domain warning.
- Consider replacing or migrating the garbled `CLAUDE.md` once the new docs have
  been accepted.
- Add feature-level tests whenever true solar time or birthplace matching behavior
  changes.
- Use GitHub issue templates for new feature, bug, and internal development work.
- Keep the in-app open source links pointed at `ziweiknows/ziwei-chart`.

[PROTOCOL]: Update this file after each feature, fix, release, deployment change,
or notable verification run.
