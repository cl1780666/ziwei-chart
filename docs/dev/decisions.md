# Decisions

> L2 | Parent: `AGENTS.md`

## D013 — Mini Program stays silent

On 2026-11-02 the user requested removing music. Remove the native audio
context, App playback hooks, all eight page controls, and music-only tests.
This supersedes D012 for the Mini Program. The separate website's existing
music and hosted licensed tracks are outside this native change.

## D012 — Foreground music reuses existing licensed hosting (superseded by D013)

Restore the website's four quiet Bossa Nova tracks through a global native
`InnerAudioContext`, directly streaming existing HTTPS URLs. Keep only one
play/pause control; advance on end and loop the playlist. Pause on App hide,
resume only when the user's prior intent was playing, and never automatically
retry an error. Avoid new binaries, downloads, provider dependencies, recording
permissions, or background-audio declarations. Initial autoplay is attempted,
with explicit playback available when the device blocks it. Real-device audio
and domain checks remain release checks; the direct-src API is not a promise
that every device will permit autoplay.

## D001 - True Solar Time Uses Birthplace Matching

Users should not need to know longitude, latitude, or minute-level correction
details. The app accepts a normal birthplace text input and resolves it against a
local coordinate dataset. The UI should keep this approachable for ordinary users.

Consequence: improvements should prefer better matching, aliases, and clear
fallbacks over asking users for raw coordinates.

## D002 - Coordinate Data Is Local

The app uses local coordinate data from `88250/city-geo` instead of relying on a
network geocoding API for every chart calculation.

Reasons:

- Works without a third-party API key.
- Avoids leaking birth location queries to an external service.
- Keeps chart generation deterministic.

Consequence: dataset license and source attribution must remain tracked under
`docs/licenses/`.

## D003 - CloudBase Is the Public Deployment Target

The public site uses Tencent CloudBase so it can be opened directly from mainland
China. Static website hosting serves the Vite build. The HTTP gateway routes
`/api/chat` to a CloudBase HTTP function and `/` to static hosting by longest
path match.

The older GitHub mirror workflow and Vercel deployment remain available during
the cutover, but they are no longer the target architecture. Mirror sync failures
can still be debugged by checking refs:

```powershell
git ls-remote origin refs/heads/main
git ls-remote zwknows refs/heads/main
```

## D004 - Sync Workflow Is Source-Repository Scoped

The sync workflow includes a repository guard so other forks do not push to the
user's deployment mirror.

Consequence: keep this condition unless the deployment model changes:

```yaml
if: github.repository == 'ziweiknows/ziwei-chart'
```

## D005 - Documentation Is Part of the Deliverable

Every meaningful implementation change must update development documentation in
the same change set. This keeps agent context cheap and prevents project memory
from living only inside chat history.

Consequence: do not mark future work complete until the relevant docs are updated.

## D006 - GitHub Templates Enforce Development Discipline

GitHub issue and pull request templates are used to make scope, verification, and
documentation impact explicit before work is accepted.

Consequence: feature, bug, and task issues should identify documentation impact.
Pull requests must treat documentation updates as part of the same deliverable as
code and tests.

## D007 - Shared AI Uses TokenHub, a Server-Only Key, and Signed Visitor Quota

Visitors who do not configure a personal provider key use `/api/chat`. The public
CloudBase route calls Tencent TokenHub's mainland Responses API. `TOKENHUB_API_KEY`
and `RATE_LIMIT_SECRET` stay in server environment variables and must never be
exposed through `VITE_` variables or client code.

The shared allowance is five successful AI requests per browser per UTC day,
stored in an HMAC-signed, HttpOnly cookie. The function also applies a
best-effort four-request-per-minute IP burst limit. Personal keys preserve the
existing browser-only provider flow and do not consume the shared allowance.
Generating the full natal report and sending each follow-up chat question each
consume one request from this same allowance.

Consequence: the cookie quota is appropriate for a small friends-and-family
site. A strict global, account, or cross-device limit requires durable storage
and identity rather than extending the cookie scheme.

TokenHub free-trial exhaustion returns a friendly unavailable message. It does
not affect deterministic chart, matching, fortune, or K-line features, and no
postpaid service is required by this design.

## D008 - The Mini Program Uses HTTP WeChat Login and Trusted CloudBase UID

The paid PostgreSQL environment is not selectable in WeChat DevTools' native
environment conversion. The native Mini Program therefore uses CloudBase JS SDK
OpenID login with `useWxCloud: false`, then authenticated SDK `callFunction` to
invoke the event-triggered `ziwei-mini` backend. The enabled identity source is
the registered Mini Program AppID; the SDK exchanges the one-use `wx.login` code.

The cloud function gets its trusted UID through the Node SDK's runtime
`auth().getUserInfo()` and rejects missing or anonymous identities. It never
accepts a user identifier from event data. Documents are keyed as `uid:<uid>`;
only daily quota, request leases, and necessary timestamps remain in
`ziwei_mini_users`.
The PG environment provides document operations through `pgdoc`, with client
database access disabled. The existing per-user transactional reservation,
refund, and account isolation rules remain in force. Birth profiles, charts,
and chats use account-scoped local storage on each device. The same account on
another phone must not receive any earlier device's personal records.

The Mini Program's backend calls the fixed, owned website `/api/chat` endpoint
to reuse the already configured TokenHub `deepseek-v4-flash-202605` free-trial
resource. The server-only adapter forwards messages without user cookies or
page-supplied URLs, reads the Responses SSE protocol, and times out after 80
seconds. Its own durable UID quota is twenty questions per Shanghai day; the
website retains its five-request browser allowance and four-per-minute IP burst
guard. No separate CloudBase AI activation or new provider key is required.

Consequence: Mini Program identity and quota changes belong in `ziwei-mini`; do
not reuse the website cookie as Mini Program identity. Authorize and enable
the Mini Program identity source before device testing. Keep all provider and
management credentials out of the bundled client SDK and page code.

## D009 - The Mini Program Uses a Wannan Editorial Poster Visual System

The personalized Mini Program uses an original nine-image poster series that
combines antique violins, Wannan mountains and water, Hui-style white walls and
dark roofs, a quiet courtyard, four seasons, and one restrained adult violinist
seen from behind at night. Supporting pages use
rice-paper ivory, ink green, walnut, and restrained burgundy with Song-style
display typography. The direction should stay romantic, quiet, and editorial
rather than returning to generic pink gradients or floating music-note
decoration.

The production image lives in `miniprogram/assets`; the browser mock under
`design-preview/` mirrors the home composition for review before a real AppID is
available.

Consequence: future Mini Program visual changes should preserve poster hierarchy,
legibility over the artwork, and package-conscious compressed assets. Keep the
home screen simple and avoid using `0819` as decorative branding there. Keep
the automatic background rotation slow and control-free, and stop its timers
when the page is hidden. Keep functional copy and controls in WXML instead of
baking text into the image.

## D010 - Personal Mini Program Content Stays on the Current Device

The user explicitly rejected backend retention and cross-device synchronization,
including two phones using the same WeChat account. Birth profiles, chart
summaries, and chat history therefore belong only in that device's local storage.
Clearing local data or reinstalling can lose these records; do not restore them
from the cloud or add a cloud fallback.

Chart calculation and AI requests still transiently send the needed profile,
question, and bounded recent conversation to the server/model. The backend
recalculates charts and validates history without retaining personal content.
Only the authenticated account's quota persists in the cloud. Database field
allowlisting strips old content while keeping its counter; releases must also
check for unvisited legacy documents and clean them before completion.

Application error logs use fixed codes and HTTP status only. Never log request
or response text, provider error bodies, or arbitrary error messages that could
echo a prompt. This application-level rule is not a claim about third-party
provider data-retention terms.

## D011 - Native Mini Program Feature Parity Uses Shared Quota and Local Reports

The Mini Program includes dedicated full-chart/natal, yearly, 100-year K-line,
compatibility, and share-card views. These are independent functional pages;
general chat is not a substitute for yearly reports or a real interactive curve.
Keep all reports, trends, partner drafts, and chart content on the current device.

Deterministic chart, yearly, and basic curve calculation does not consume model
allowance. Every model task uses the same authenticated quota reservation path;
an AI full-curve generation consumes one successful request, not one per year.
Its compact response must contain all 100 valid OHLC/dimension rows. Reject and
refund incomplete or invalid model data instead of fabricating missing years.

The `lifetime_curve_v3` wire object has only a `decades` field: exactly ten
groups, each containing only `startAge` and ten `rows` of seven integers.
Group starts must be 1, 11, 21, …, 91 in order; flatten the validated ten by ten
groups into 100 points. Each row is:
`[close, upperWick, lowerWick, career, wealth, relationship, health]`.
The first open is 50 and later opens are the prior close. Decode high as
`min(100, max(open, close) + upperWick)` and low as
`max(0, min(open, close) - lowerWick)`. This prescribed representation avoids
asking the model to maintain cross-row envelope constraints; it does not repair
invalid numbers or fill absent years. Do not guess the former absolute-high/low
format. Every group, starting age, row and integer still undergoes strict
validation. Ten-year grouping replaces the unreliable flat 100-row model
response without filling absent data or making extra model calls.
The fixed curve mode also requests the matching Responses `text.format`
JSON Schema. Server validation remains authoritative because provider support
does not prove every constraint was enforced on a particular response.

The complete curve alone uses a fixed proxy mode with reasoning disabled and
a 6000-token output cap; ordinary chat/reports keep low reasoning and 3000.
Live testing established that the previous shared cap truncated the 100-row
response. The flag is an enum, not authentication or an arbitrary model-option
channel; all pre-existing quota and IP controls remain.

Basic curves reuse the original star/brightness/transformation scoring approach
with deterministic real chart and transit sampling. Do not add arbitrary random
variation. These are traditional chart illustrations, not measured probabilities,
investment prices, or lifespan predictions. Use actual transit scopes for palace
overlays and traditional nominal-age decadal ranges.

[PROTOCOL]: Add a new decision when a choice affects future implementation,
deployment, product behavior, or contributor workflow.
