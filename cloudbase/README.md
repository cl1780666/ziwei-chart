# CloudBase release

The public site uses two CloudBase resources behind one HTTP gateway domain:

- `/` routes to static website hosting.
- `/api/chat` routes to the `ziwei-ai` HTTP function.

The HTTP function listens on port `9000` and calls Tencent TokenHub's mainland
Responses API. Configure these server-only environment variables in CloudBase:

```text
TOKENHUB_API_KEY=<TokenHub API key>
TOKENHUB_MODEL=deepseek-v4-flash-202605
RATE_LIMIT_SECRET=<long random value>
AI_DAILY_LIMIT=5
```

Do not add these values to frontend variables or commit them to Git.

The function upload ZIP must contain `index.js`, `package.json`, and the
executable `scf_bootstrap` at the ZIP root.

After building `app/`, run `cloudbase/build-static-release.mjs` to create the
static upload folder. The script copies the four selected licensed music tracks
into the release and rewrites their CDN URLs to same-origin `/audio/` paths.
