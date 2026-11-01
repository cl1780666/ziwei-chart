# App Agent Guide

> L2 | Parent: `../AGENTS.md`

## Scope

This directory contains the Vite React application. Read this file before
modifying files under `app/`.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- Zustand
- Vitest
- ESLint
- iztro

## Commands

Run from `app/`:

```powershell
npm run dev
npm run lint
npm run test
npm run build
```

Targeted examples:

```powershell
npm run test -- true-solar-time
npm run test -- retrieve
npm run test -- sync-zwknows
```

## Member List

`src/main.tsx`: React entry point and app mounting.

`src/App.tsx`: Top-level application composition.

`src/components/`: Feature UI components. Keep deterministic calculation logic in
`src/lib/` instead of embedding it in components.

`src/components/ui/`: Small reusable UI primitives.

`src/components/OpenSourceLinks.tsx`: GitHub repository and license links for
open source attribution in the app shell.

`src/components/WelcomeLeiLei.tsx`: Personalized `For Lei · 0819` entrance with
romantic copy and motion-safe decorative elements.

`src/components/icons/ViolinIcon.tsx`: Code-native violin illustration reused by
the welcome screen and application shell.

`src/lib/`: Business helpers for date handling, astrology support, true solar
time, birthplace data, LLM wiring, and scoring.

`api/chat.ts`: Vercel-compatible server function for shared Tencent TokenHub
streaming, request validation, and quota enforcement. Server secrets must remain
environment-only.

`api/rate-limit.ts`: HMAC-signed daily quota cookie helpers.

`src/lib/true-solar-time.ts`: True solar time and birthplace matching logic.

`src/lib/birthplace-data.json`: Local coordinate dataset used for birthplace
matching.

`src/knowledge-db/`: Structured guidance database and retrieval pipeline.

`src/knowledge/`: Static domain knowledge used by the app.

`src/stores/`: Zustand state boundaries.

`tests/`: Tests that sit outside `src`, including workflow contract tests.

## Change Rules

- UI behavior changes should keep form flows usable for non-technical users.
- True solar time changes must protect users from needing raw longitude, latitude,
  or manual minute correction unless explicitly requested later.
- Birthplace matching changes should be tested against realistic city input.
- Workflow changes should keep the source repository guard and deployment mirror
  intent intact.
- Shared AI changes must keep `TOKENHUB_API_KEY` out of frontend code and preserve
  the personal-key provider path.
- Documentation changes are required for meaningful app behavior, module, command,
  or workflow changes.

## Verification Guide

- Calculation helper change: run the matching targeted Vitest file and then
  `npm run test`.
- UI component change: run `npm run lint`, relevant tests, and browser-check the
  changed flow when practical.
- Build or dependency change: run `npm run build`.
- GitHub workflow change: run `npm run test -- sync-zwknows`.

[PROTOCOL]: Update this file when app structure, commands, key files, or app-level
development rules change.
