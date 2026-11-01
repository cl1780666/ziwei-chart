# Decisions

> L2 | Parent: `AGENTS.md`

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

[PROTOCOL]: Add a new decision when a choice affects future implementation,
deployment, product behavior, or contributor workflow.
