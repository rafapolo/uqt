# Plan: Client-Side JS Error Reporting → GitHub Issues

## Context
UQT has no visibility into client-side JS errors. The goal is to capture unhandled errors and promise rejections in the browser and automatically open GitHub Issues at `rafapolo/uqt`. The GitHub token cannot live in client-side JS, so a proxy endpoint mediates the call.

---

## Architecture
```
browser error → window.onerror / unhandledrejection
             → POST https://uqt.xn--2dk.xyz/api/error-report  (fire-and-forget)
             → proxy.js validates + deduplicates
             → POST https://api.github.com/repos/rafapolo/uqt/issues
```

---

## Step 1 — GitHub token (manual, before deploy)

Create a **fine-grained PAT** at GitHub Settings → Developer settings → Fine-grained tokens:
- Repository: `rafapolo/uqt` only
- Permission: **Issues → Read and write**

Set `GITHUB_TOKEN=<token>` in the haloy host environment.

---

## Step 2 — `haloy.yaml` (add 3 lines)

File: `/Users/polux/Projetos/uqt/haloy.yaml`

After the `AWS_SECRET_ACCESS_KEY` block (line 16), add:
```yaml
  - name: GITHUB_TOKEN
    from:
      env: GITHUB_TOKEN
  - name: S3_ENDPOINT
    from:
      env: S3_ENDPOINT
```
(Also add `S3_ENDPOINT` since proxy.js reads it but it wasn't in haloy.yaml yet.)

---

## Step 3 — `proxy.js`

File: `/Users/polux/Projetos/uqt/proxy.js`

### 3a. Add `https` module (after line 6)
```js
const https = require('https');
```

### 3b. Add deduplication cache + helpers (after line 20, after `s3` init)
```js
const _errCache = new Map();
const _ERR_TTL = 60 * 60 * 1000;
function _errFingerprint(b) { return `${b.message}|${b.source}|${b.lineno}`; }
function _isDupe(fp) {
  const t = _errCache.get(fp);
  if (!t) return false;
  if (Date.now() - t < _ERR_TTL) return true;
  _errCache.delete(fp);
  return false;
}
function _recordErr(fp) {
  _errCache.set(fp, Date.now());
  for (const [k, t] of _errCache) if (Date.now() - t > _ERR_TTL) _errCache.delete(k);
}
```

### 3c. Update `corsHeaders` (line 24) — add POST
```js
'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST',
```

### 3d. Add `createGithubIssue` helper (after `mimeFor`, before `handleObject`)
```js
function createGithubIssue(b) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) { console.error('[error-report] GITHUB_TOKEN not set'); return; }
  const title = `[client error] ${String(b.message || 'unknown').slice(0, 100)}`;
  const body = [
    '## Client-Side JS Error',
    `**Message:** \`${b.message}\``,
    `**Source:** \`${b.source}\` line ${b.lineno} col ${b.colno}`,
    `**URL:** ${b.url}`,
    `**UA:** ${b.userAgent}`,
    `**Time:** ${b.timestamp}`,
    '### Stack', '```', String(b.stack || '(none)').slice(0, 4000), '```',
    '_Auto-reported by UQT client._',
  ].join('\n');
  const payload = JSON.stringify({ title, body, labels: ['bug', 'client-error'] });
  const req = https.request({
    hostname: 'api.github.com', path: '/repos/rafapolo/uqt/issues', method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload), 'User-Agent': 'uqt-proxy/1.0',
      Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
    },
  }, res => {
    let d = '';
    res.on('data', c => { d += c; });
    res.on('end', () => {
      if (res.statusCode === 201) console.log(`[error-report] issue created: ${JSON.parse(d).html_url}`);
      else console.error(`[error-report] GitHub ${res.statusCode}: ${d.slice(0, 200)}`);
    });
  });
  req.on('error', e => console.error('[error-report] request failed:', e.message));
  req.write(payload);
  req.end();
}
```

### 3e. Insert `POST /api/error-report` route — BEFORE line 83 (the method guard)

Insert between the `OPTIONS` block (ends line 81) and the method guard (line 83):
```js
  if (req.method === 'POST' && req.url === '/api/error-report') {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
      let parsed;
      try { parsed = JSON.parse(raw); } catch {
        res.end(JSON.stringify({ ok: false, reason: 'bad-json' })); return;
      }
      const fp = _errFingerprint(parsed);
      if (_isDupe(fp)) {
        console.log(`[error-report] dupe suppressed: ${fp.slice(0, 80)}`);
        res.end(JSON.stringify({ ok: true, reason: 'duplicate' })); return;
      }
      _recordErr(fp);
      console.log(`[error-report] new error: ${String(parsed.message).slice(0, 100)}`);
      res.end(JSON.stringify({ ok: true }));
      createGithubIssue(parsed);
    });
    return;
  }
```

---

## Step 4 — `js/uqt.js`

File: `/Users/polux/Projetos/uqt/js/uqt.js`

### 4a. Prepend error reporting block (before line 1 `// State`)
```js
// ── Error reporting ───────────────────────────────────────────────────────
const _ERR_URL = 'https://uqt.xn--2dk.xyz/api/error-report';
const _ERR_LIMIT = 5;
let _errCount = 0;

function reportError(data) {
  if (_errCount >= _ERR_LIMIT) return;
  _errCount++;
  try {
    fetch(_ERR_URL, {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (_) {}
}

function _isExtensionSrc(s) {
  return s && /^(chrome|moz|safari)-extension:\/\//i.test(s);
}

window.onerror = function (message, source, lineno, colno, error) {
  if (message === 'Script error.' || _isExtensionSrc(source)) return false;
  reportError({ message: String(message), source, lineno, colno,
    stack: error?.stack || null, userAgent: navigator.userAgent,
    url: location.href, timestamp: new Date().toISOString() });
  return false;
};

window.addEventListener('unhandledrejection', e => {
  const r = e.reason;
  reportError({ message: r instanceof Error ? r.message : String(r ?? 'unhandled rejection'),
    source: location.href, lineno: null, colno: null,
    stack: r instanceof Error ? r.stack : null, userAgent: navigator.userAgent,
    url: location.href, timestamp: new Date().toISOString() });
});
// ── End error reporting ───────────────────────────────────────────────────
```

### 4b. Wrap the unguarded data fetch (lines 706-709) in try-catch
```js
let json;
try {
  json = await new Response(
    (await fetch('js/uqt-albums.json.gz')).body.pipeThrough(new DecompressionStream('gzip'))
  ).text();
} catch (err) {
  reportError({ message: `Failed to load album database: ${err.message}`,
    source: location.href, lineno: null, colno: null, stack: err.stack || null,
    userAgent: navigator.userAgent, url: location.href, timestamp: new Date().toISOString() });
  throw err;
}
db = JSON.parse(json);
```

---

## Verification

```bash
# 1. Deploy
haloy deploy

# 2. Manual smoke test — should create a GitHub issue
curl -X POST https://uqt.xn--2dk.xyz/api/error-report \
  -H 'Content-Type: application/json' \
  -d '{"message":"test error","source":"https://uqt.xn--2dk.xyz/","lineno":1,"colno":1,"stack":"Error\n  at test","userAgent":"curl","url":"https://uqt.xn--2dk.xyz/","timestamp":"2026-04-19T00:00:00Z"}'

# 3. Same POST again — should return {"ok":true,"reason":"duplicate"} with no new issue

# 4. Check https://github.com/rafapolo/uqt/issues for the created issue
```
