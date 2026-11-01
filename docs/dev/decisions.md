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

## D003 - Deployment Uses a Mirror Repository

`ziweiknows/ziwei-chart` is the development source. `ruijayfeng/zwknows` is the fork or
mirror connected to Vercel. The source repository syncs to the deployment mirror
through GitHub Actions.

Consequence: Vercel does not need to point at the source repository. Sync failures
should be debugged in GitHub Actions first, then by checking refs:

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

## D007 - Shared AI Uses a Server-Only Key and Signed Visitor Quota

Visitors who do not configure a personal provider key use the Vercel function at
`/api/chat`. `OPENAI_API_KEY` and `RATE_LIMIT_SECRET` stay in server environment
variables and must never be exposed through `VITE_` variables or client code.

The shared allowance is five successful AI requests per browser per UTC day,
stored in an HMAC-signed, HttpOnly cookie. The function also applies a
best-effort four-request-per-minute IP burst limit. Personal keys preserve the
existing browser-only provider flow and do not consume the shared allowance.

Consequence: the cookie quota is appropriate for a small friends-and-family
site. A strict global, account, or cross-device limit requires durable storage
and identity rather than extending the cookie scheme.

[PROTOCOL]: Add a new decision when a choice affects future implementation,
deployment, product behavior, or contributor workflow.
