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

- Removed native Mini Program background music at the user's request: App
  playback hooks, the shared audio module, all eight page controls, and nine
  music-only tests. The separate website and hosted tracks are unchanged.
  Official WCC/WCSC compilation passed for all eight pages and the remaining
  report component; eighteen JS and twelve JSON files passed syntax checks,
  with no stale audio references or diff errors. Source package is 1,970,569
  bytes. DevTools recompiled without errors, showing no playback button and
  the unchanged eleven remaining calls; no model request was made.
  The silent phone preview was uploaded again: code package 1878 KB, with a
  fresh QR code generated.
- Restored the original website's five core tabs in the native Mini Program:
  full twelve-palace star details and natal report, annual transit charts and
  independent yearly report, a 100-year OHLC curve with four-dimensional radar
  and selected-year reports, independent two-person compatibility, and local
  PNG share cards. The home now links to all features and the existing chat.
- Added free deterministic annual/lifetime calculations and a common AI report
  endpoint. Natal, yearly, compatibility, full-curve and selected-year reports
  share chat's existing twenty-use daily quota and failure refunds. AI curves
  must contain exactly 100 bounded, complete rows with valid OHLC envelopes;
  truncated or malformed output is rejected and refunded.
- Preserved device-only privacy for every new report, curve, and partner draft.
  Local report caches are keyed by profile, feature, year/age and partner,
  bounded to twelve entries, and invalidated when the primary profile changes.
  Schema-1 local charts upgrade without importing cloud content or losing local
  conversations. Native forwarding uses generic artwork; generated cards hide
  birth details by default and leave the phone only through an explicit export.
- Corrected annual palace indexing and pre-lunar-new-year decadal scope using
  iztro's actual nominal age. Annual charts and lifetime points now consistently
  use the engine's palace, stem and decadal range rather than mixing calendar
  age with traditional nominal-age boundaries.
- Passed 108 focused backend, privacy, feature UI, chart geometry, lifecycle and
  proxy tests on 2026-11-02. This includes concurrent final-slot reservations,
  invalid-curve refunds, cross-device/account storage separation, stale page
  responses, cached reports, and private PNG/forwarding behavior.
- Added the exact current Shanghai date, lunar nominal age and active decadal
  to AI context after a live natal report guessed the prior decade. Optimized
  quarterly sampling using the same iztro lunar dependency and verified formulas:
  the full baseline is byte-for-byte unchanged, while local calculation fell
  from 2873 ms to 647 ms. Removed needless full-lifetime calculation from a
  single-year report. AI timeout, truncated-output and upstream failures use
  fixed diagnostic codes and retain quota refunds, with eight seconds reserved
  for finishing/refunding before the unchanged 90-second function timeout.
- Previously restored foreground Bossa Nova playback (superseded by the user's
  subsequent removal request) using one native audio context and
  the four existing licensed CloudBase tracks. The eight pages have only a
  play/pause control, with automatic playlist looping, page-to-page continuity,
  background pause, and preserved explicit pause. No MP3, new dependency,
  recording permission or background-audio capability was added. Nine focused
  audio tests and official compilation passed; source main-package size is
  1,978,743 bytes after the final component selector fix, below 2 MiB. Device
  autoplay remains a real-phone check.
- Verified full features in DevTools against the live backend: detailed star
  data, natal report, independent annual report, free complete baseline curve
  and four-axis radar, independent compatibility using a synthetic partner,
  selected-year curve report, and locally generated PNG preview. Successful
  reports reduced the remaining allowance 16 → 15 → 14 → 13 → 12; failed
  full-curve attempts were refunded and kept the existing baseline. Safe
  diagnostics identified truncation and later missing rows. The final V3
  ten-by-ten grouped response generated all 100 AI points successfully and
  reduced the remaining allowance 12 → 11, preserving the selected 2027 year
  and updating its four-dimensional scores. Reopening
  cached reports and recompiling retained local content without further charge.
  The complete cloud collection still contained one quota-only record, no
  profile, chart, report, partner or chat fields.
- Deployed the optimized event function and the fixed curve-only proxy mode
  in the existing environment. Current timing, model credentials, runtime and
  256 MB memory remain; no new paid environment or resource allocation was
  created. The final complete AI curve passed real provider decoding and
  strict server validation; the development preview still needs the user's
  same-account/two-phone privacy check before public review.
- Recompiled after the successful AI curve and reopened it from the local cache:
  it still showed AI inference with eleven calls remaining, without invoking
  the model again. The complete quota collection remained a single document
  with count nine, no pending request, and timestamps only. Uploaded the new
  development preview successfully; DevTools generated a fresh phone QR and
  reported a 1883 KB code package. Same-account/two-phone separation and album
  permission checks remain explicitly unconfirmed by the user. The later music
  removal supersedes the real-phone audio check.
- Replaced Mini Program cloud content storage with device-local, account-scoped
  profiles, chart summaries, and chats at the user's explicit request. Another
  phone, including the same WeChat account, starts without personal records.
  `getState` accepts only cloud quota; it never imports legacy personal content.
  Local operations serialize profile changes, questions, and clears, report
  storage failures, and discard responses after an account switch.
- Converted `ziwei-mini` to quota-only persistence with field allowlisting that
  strips legacy profile/chart/chat content while retaining counters. Chart and
  AI processing use the current request's validated profile and bounded local
  history transiently; answers return only to the requesting device. Daily
  twenty-use reservations, refunds, and abandoned-request recovery remain.
- Removed provider error bodies and arbitrary exception text from CloudBase
  proxy logs. The Mini Program backend also logs only fixed error codes; neither
  application path logs personal prompts or answers. The local-only privacy
  behavior supersedes the cross-device persistence checks below. Applied the
  same provider-body logging fix to the retained Vercel source path.
- Deployed both privacy function updates in place on 2026-11-02, preserving the
  existing environment and server keys. The one legacy document was scrubbed
  with user confirmation; inspecting the complete collection showed only quota,
  request state, and timestamps. Two fresh contextual answers reduced the
  allowance 18 → 17 → 16 without recreating private fields. The current device
  retained its new profile and both exchanges across recompilation.
- Deployed the HTTP-authenticated `ziwei-mini` event function in the existing
  paid Shanghai environment on 2026-11-02. Verified Node.js 20.19, `index.main`,
  the 90-second execution timeout, online-installed dependencies, and the
  twenty-use daily setting. Enabled the matching Mini Program identity source,
  `pgdoc`, and the admin-only `ziwei_mini_users` collection, and saved the exact
  API gateway request domain in the Mini Program whitelist.
- Verified the registered Mini Program in WeChat DevTools against the live
  backend: WeChat login, profile persistence, twelve-palace chart generation,
  two successful contextual AI turns, quota decreasing 20 → 19 → 18, and the
  saved profile, both chat exchanges, and remaining allowance surviving
  recompilation. This is a
  development build; two-account real-device checks and platform review remain.
- Compiled and uploaded a development preview successfully. WeChat DevTools
  reported a 1799 KB code package / 1.8 MB compiled size and generated the
  phone-preview QR code. The user scanned it with the bound developer WeChat
  account and confirmed the phone opens the app and shows “欢迎蕾蕾大王”.
  Profile saving and chat on the phone, two-account device isolation, and public
  release remain unverified.
- Raised the Mini Program allowance to twenty questions per authenticated user
  per Shanghai day and updated the home/chat initial count. The website retains
  its existing five-use browser allowance.
- Reused the website's already configured TokenHub free-trial model through a
  fixed server-only `/api/chat` adapter. It sends only messages without cookies,
  decodes Responses SSE without duplicating full-text done events, and refunds
  Mini Program quota on provider errors, interrupted output, or an 80-second
  timeout. CloudBase AI model activation and a new provider key are not required.
- Adapted the Mini Program to reuse the paid PostgreSQL environment after
  DevTools confirmed it cannot be selected for native environment conversion.
  A bundled CloudBase JS SDK 3.10.4 exchanges WeChat login codes using ordinary
  HTTPS and calls the existing event function with its authenticated session.
  The backend uses trusted CloudBase runtime UID, rejects missing/anonymous
  identities, and ignores client identity claims. The native database wrapper
  and atomic per-user quota store remain in use. AI calls now use the fixed
  existing TokenHub website route described above.
- Added a reproducible Auth/Functions-only production client bundle with upstream
  licenses and a build-time check that the complete Mini Program main package
  stays below 2 MiB. No provider credential is included in the bundle.
- Made the Mini Program's daily quota atomic before deployment. A short database
  transaction reserves one request and a per-user in-flight lease before AI runs;
  handled AI failures refund the reservation and abandoned requests recover after
  two minutes. The privacy revision retains metadata-only quota transactions;
  the client serializes local profile edits and conversation clears instead of
  persisting conversation content on the server.
- Added `wechat-miniapp/cloudbaserc.json` with documented event-function deployment
  settings, cloud dependency installation, Node.js 20.19, and an explicit
  90-second execution timeout. DevTools releases must also verify that timeout
  in the deployed function settings.
- Replaced the Mini Program's `touristappid` import placeholder with the
  registered AppID `wx7284ee2afe7ed462`. The project can now be imported under
  that application identity in WeChat DevTools.
- Simplified the Mini Program home poster by removing the `0819` seal, date,
  signature, and navigation branding. The entrance now keeps only the Lei
  welcome, a daily quote, one primary action, and compact saved-state metadata.
- Added an automatic nine-scene home background rotation. The scenes crossfade
  every 6.5 seconds with a restrained slow push, require no visible controls,
  and stop their timers while the home page is hidden.
- Renamed the home quote feature to `蕾言蕾语` and made it randomly rotate every
  seven seconds without an immediate repeat. The compact translucent sheet
  clamps each quote to two lines so the artwork remains the primary visual.
- Expanded `蕾言蕾语` from fourteen to five hundred unique short lines. The set
  now focuses on relationship-reversal jokes, rich-and-stylish older-sister
  lines, and absurd short-video phrasing. Clear-headed relationship advice,
  self-admiration jokes, Wannan/violin references, and gentle romantic lines
  were removed at the user's request. A JSON mirror keeps the browser design
  preview on the same five-hundred-line pool as the native Mini Program.
- Expanded the original artwork into a nine-image Wannan and violin series. The
  profile page now uses an autumn tree masthead and courtyard scene, the chart
  page uses a quiet river-at-night scene, and the chat page uses a restrained
  violin-by-the-rain-window banner. The home rotation adds spring tea fields,
  summer lotus water, a winter snow window, and one restrained moonlit adult
  violinist seen from behind. All assets are compressed for the Mini Program
  package and contain no baked-in interface copy.
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

Reverified on 2026-11-02 after HTTP WeChat login integration:

- Privacy revision: all 44 focused tests passed (24 backend, 16 client, 4 proxy).
  Coverage includes fresh second-device storage for the same identity, account
  changes, local persistence/failures, serialized clears, legacy cloud-field
  removal, bounded transient prompts, safe error logs, quota races and refunds.
  Official WXML/WXSS compilation and JS/JSON parsing passed. The updated main
  package is 1,889,428 bytes, below 2 MiB. Live privacy checks passed for local
  save/reopen, two-turn context, quota 18 → 17 → 16, and no personal content
  reappearing in the entire cloud collection. Mobile separation is pending.
- The retained Vercel path passed 8/8 focused privacy/quota tests, its Node
  TypeScript check, and targeted ESLint. Its log fix is saved as source; the
  active CloudBase proxy was deployed and used by the live Mini Program checks.
- All twenty-two Mini Program tests passed, including trusted UID and anonymous
  rejection, forged client identity isolation, shared/retryable frontend login,
  and a smoke check of the actual production SDK bundle in an isolated Mini
  Program runtime. The smoke check observed the expected `/auth/v1/provider/token`
  HTTPS request and did not contact a live service.
- The fixed TokenHub adapter tests also passed for split UTF-8 SSE, full-text
  fallback without duplicate output, HTTP/provider errors, incomplete streams,
  and an abort while streaming. The default per-user allowance is verified at 20.
- Rebuilt the production SDK at 562,644 bytes; the complete Mini Program main
  package, including upstream licenses, totals 1,882,308 bytes (below 2 MiB).
- Live provider login, trusted function identity, PG document writes and
  transactions, contextual AI output, and quota persistence passed in DevTools
  against the deployed backend. Two-account real-device checks remain pending.

Reverified on 2026-11-01 after atomic Mini Program quota reservations:

- All nine Mini Program backend tests passed, including concurrent last-slot
  requests, in-flight profile/history mutation protection, model-failure refunds,
  independent users, abandoned-request recovery, stale responses, and day rollover.
- Backend JavaScript and the deployment JSON parsed successfully; `git diff
  --check` passed. The transaction conflict tests use a local optimistic database
  harness; live CloudBase and two-account device verification remain required.

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

Reverified on 2026-11-01 after the simplified home and expanded artwork pass:

- The home browser mock contains no `0819`, birth-date, or seal element.
- The Mini Program artwork package contains nine compressed JPEG assets totaling
  about 1.2 MB, with the autumn tree, courtyard, night-river, and rain-window
  scenes assigned to the profile, chart, and chat pages and all nine available
  to the home rotation.

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

- The registered Mini Program's HTTP OpenID identity source must stay enabled in
  the paid environment. Native PG environment conversion is unavailable in
  DevTools; do not retry it or create another paid environment to work around it.
- `pgdoc`, client-deny collection permissions, event-function deployment, and
  request-domain registration are configured. Verify account isolation on two
  real WeChat accounts and same-account data separation on two phones before
  publishing this Mini Program flow. Inspect the entire quota collection after
  the privacy deployment to confirm no legacy personal content remains.
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

- Run a two-account real-device check, then complete the Mini Program privacy
  declaration, service category, and platform review before public release.
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
