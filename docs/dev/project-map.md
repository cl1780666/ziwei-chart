# Project Map

> L2 | Parent: `AGENTS.md`

## Purpose

This file gives future agents a fast structural map before they touch code. Keep
it factual and compact.

## Application Shape

The app is a Vite React application under `app/`. It uses TypeScript, React 19,
Zustand, Tailwind CSS 4, Vitest, ESLint, and iztro for Zi Wei Dou Shu charting.

Primary runtime flow:

1. User enters birth data in the form.
2. Birth date and birthplace inputs are normalized.
3. True solar time correction can adjust the effective birth time.
4. iztro generates the chart.
5. App state stores the chart and user selections.
6. UI renders chart, fortune, match, K-line, share, AI interpretation, and
   chart-grounded follow-up conversation views.
7. Knowledge retrieval grounds AI prompts with local structured guidance.
8. Visitors without a personal key send grounded prompts to `/api/chat`, which
   enforces quota checks before streaming Tencent TokenHub output.

The companion Mini Program has a separate runtime flow:

1. The bundled CloudBase JS SDK exchanges `wx.login` codes through HTTP OpenID
   login and calls the event function with its authenticated session. The backend
   obtains a trusted CloudBase runtime UID and rejects anonymous callers.
2. The cloud function transiently validates a birth profile, matches birthplace
   data, applies true solar time, and generates a chart with iztro. Only the
   requesting device stores the profile and chart summary, in local storage
   scoped to its authenticated account.
3. Chat requests supply that device's profile and bounded recent history. The
   server recalculates the chart, reserves the UID's Shanghai-day quota of twenty
   questions, calls the existing TokenHub proxy, and returns the answer to that
   device. The device alone appends its local history.
4. Cloud documents contain only quota counters, request leases, and necessary
   timestamps. Field allowlisting strips legacy personal content. No device
   imports cloud profiles or chats; the same account on another phone starts
   without personal records while sharing the account's remaining quota.

## App Module Map

<directory>
app/src/components/ - React UI components grouped by feature.
app/src/components/ui/ - Small reusable UI primitives.
app/src/lib/ - Business logic helpers and calculation support.
app/src/stores/ - Zustand state.
app/src/knowledge-db/ - Structured guidance database and retrieval pipeline.
app/src/knowledge/ - Static Zi Wei Dou Shu knowledge modules.
app/api/ - Vercel server functions for shared AI access and signed quota state.
cloudbase/functions/ziwei-ai/ - CloudBase HTTP function for the public shared AI route.
wechat-miniapp/miniprogram/ - Native WXML/WXSS/JS pages and authenticated cloud-function client.
wechat-miniapp/miniprogram/assets/ - Project-bound Mini Program poster imagery.
wechat-miniapp/design-preview/ - Browser-reviewable mock of the Mini Program visual direction.
wechat-miniapp/cloudfunctions/ziwei-mini/ - Mini Program profile, chart, chat, and quota backend.
app/tests/ - Tests outside source tree, currently including workflow validation.
</directory>

## Important Files

- `app/src/components/BirthForm.tsx` - birth input, birthplace matching entry, and true solar time options.
- `app/src/components/WelcomeLeiLei.tsx` - personalized romantic entrance shown on page load.
- `app/src/components/AIInterpretation.tsx` - natal report plus multi-turn questions grounded in the active chart.
- `app/src/components/icons/ViolinIcon.tsx` - reusable inline violin artwork for the welcome and shell.
- `app/src/components/OpenSourceLinks.tsx` - GitHub repository and license links for open source attribution.
- `app/src/lib/true-solar-time.ts` - true solar time calculation and birthplace matching helpers.
- `app/src/lib/birthplace-data.json` - local city/region coordinate dataset.
- `app/src/lib/birth-date.ts` - birth date handling.
- `app/src/lib/astro.ts` - chart-facing astrology helpers.
- `app/src/lib/llm.ts` - personal-provider adapters and shared server streaming.
- `app/api/chat.ts` - Vercel-compatible TokenHub proxy, validation, and stream forwarding.
- `app/api/rate-limit.ts` - signed daily quota cookie helpers.
- `cloudbase/functions/ziwei-ai/index.js` - deployable CloudBase TokenHub proxy.
- `wechat-miniapp/miniprogram/pages/` - personalized home, birth profile, chart, and chat pages.
- `wechat-miniapp/miniprogram/assets/` - nine compressed original poster scenes:
  the home violin landscape, four seasons, Hui courtyard, two night rivers, and
  quiet violin-by-the-rain-window artwork used across the four Mini Program pages.
- `wechat-miniapp/design-preview/index.html` - static phone-width visual review of the poster-style home screen.
- `wechat-miniapp/miniprogram/utils/cloudbase.js` - shared HTTP WeChat login and session initialization.
- `wechat-miniapp/miniprogram/utils/device-store.js` - current-device, account-scoped profile/chart/chat persistence.
- `wechat-miniapp/miniprogram/vendor/cloudbase.js` - self-contained production Auth/Functions SDK bundle.
- `wechat-miniapp/build-client-sdk.mjs` - reproducible SDK bundle and main-package size verification.
- `wechat-miniapp/cloudfunctions/ziwei-mini/index.js` - transient chart/AI processing and trusted UID quota enforcement.
- `wechat-miniapp/cloudfunctions/ziwei-mini/ai.js` - fixed owned TokenHub proxy endpoint, SSE decoding, and request timeout.
- `wechat-miniapp/cloudfunctions/ziwei-mini/identity.js` - trusted SDK runtime UID validation; no client identity fallback.
- `wechat-miniapp/cloudfunctions/ziwei-mini/user-store.js` - quota-only transactions and legacy personal-field removal.
- `wechat-miniapp/cloudbaserc.json` - event-function CLI deployment and explicit execution timeout.
- `wechat-miniapp/cloudfunctions/ziwei-mini/domain.js` - deterministic profile validation, true solar time, and chart context.
- `app/src/knowledge-db/retrieval/retrieve.ts` - guidance retrieval.
- `.github/workflows/sync-zwknows.yml` - deployment mirror synchronization.

## Data Sources

- Birthplace coordinate data comes from the open source `88250/city-geo` dataset.
- License text is tracked in `docs/licenses/city-geo-MulanPSL2.txt`.
- Domain knowledge is stored in the numbered root folders and in app knowledge modules.

## Boundaries

- UI components should call business helpers instead of embedding calculation logic.
- `app/src/lib/` owns deterministic data transformation and calculation helpers.
- `app/src/knowledge-db/` owns retrieval data and prompt-grounding context.
- `app/api/` and `cloudbase/functions/ziwei-ai/` own server-only credentials,
  request validation, and shared limits for their deployment targets.
- `wechat-miniapp/cloudfunctions/ziwei-mini/` owns Mini Program identity, durable
  per-user quota only, transient chart processing, and model calls; pages must not
  accept UID, OPENID, or another identity from user-controlled request data.
- Workflow tests under `app/tests/` protect repository automation contracts.

[PROTOCOL]: Update this file when module ownership, data flow, important files, or
source data changes.
