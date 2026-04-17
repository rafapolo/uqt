# UQT Proxy Setup Guide

## Overview

`proxy.js` is a small Node reverse proxy that fronts the private Hetzner Object Storage bucket `sambaraiz` (endpoint `hel1.your-objectstorage.com`). It serves audio and cover images to the web app with correct MIME types, CORS, long-lived cache headers, and HTTP Range support. It is deployed as a container via [haloy](https://haloy.ミ.xyz) and served publicly over HTTPS at **`https://uqt.ミ.xyz`**. Both the haloy host and the bucket live in Hetzner's HEL1 zone, so egress is free.

## Architecture

| File | Role |
|---|---|
| `proxy.js` | Listens on `:9001`. Uses the AWS SDK (`@aws-sdk/client-s3`) with path-style addressing to fetch objects from `sambaraiz`. Sets per-extension `Content-Type`, CORS headers, `Cache-Control: public, max-age=31536000`, and forwards `Range`/`Content-Range` for seeking. Exposes `GET /health`. |
| `Dockerfile` | `node:18-alpine`, non-root `nodejs` user, `EXPOSE 9001`, container healthcheck hitting `/health`. |
| `haloy.yaml` | Targets haloy server `haloy.ミ.xyz`, deploys to domain `uqt.ミ.xyz`, port `9001`, health check `/health`. Injects `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from the environment. |
| `js/uqt.js` | `BASE_URL = 'https://uqt.ミ.xyz/uqt'` (`js/uqt.js:26`). All track and cover URLs are built from this. |

A request to `https://uqt.ミ.xyz/uqt/<album>/<file>` maps to S3 object `sambaraiz/uqt/<album>/<file>`.

## Deploying

The deploy is a single haloy call. Three env vars must be set in the shell that runs it:

```bash
export HALOY_API_TOKEN=...       # haloy control-plane token
export AWS_ACCESS_KEY_ID=...     # Hetzner Object Storage access key
export AWS_SECRET_ACCESS_KEY=... # Hetzner Object Storage secret

haloy deploy
```

`haloy.yaml` reads all three from the environment at deploy time and passes the AWS pair through to the running container.

## Verifying the Deployment

```bash
curl -I https://uqt.ミ.xyz/health
# 200 OK, body: {"status":"ok","timestamp":"..."}

curl -I https://uqt.ミ.xyz/uqt/
# 404 (empty key), but with CORS + Cache-Control headers present

curl -I "https://uqt.ミ.xyz/uqt/<album%20path>/capa-min.jpg"
# 200 OK, Content-Type: image/jpeg, Access-Control-Allow-Origin: *
```

Then open the app and confirm a cover renders and one MP3 plays end-to-end.

## Local Testing

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
node proxy.js
# UQT Proxy listening on :9001 -> s3://sambaraiz/

curl -I http://localhost:9001/health
curl -I "http://localhost:9001/uqt/<album>/<file>.mp3"
```

Without AWS credentials the proxy starts but every object request fails with an S3 auth error.

## Syncing Content to the Bucket

Use `sync-to-bucket.js` (Node, AWS SDK v3) to upload MP3s and cover art:

```bash
node sync-to-bucket.js
```

It reads credentials from a local `.env` file and mirrors from the source path defined at the top of the script (currently the maintainer's external drive at `/Volumes/EXTRA/bkps/sambaderaiz`). Edit that constant if you're running the sync from a different machine. Files land under the `uqt/` prefix in the `sambaraiz` bucket.

## Troubleshooting

- **`/health` returns 200 but object requests 5xx** — container is running without AWS credentials. Re-export `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` and redeploy.
- **Browser logs CORB or MIME errors** — the extension isn't in the `mimeFor()` map in `proxy.js` (it falls back to `application/octet-stream`). Add it and redeploy.
- **404 on an audio or cover URL** — file hasn't been synced yet. Check `sambaraiz/uqt/<album.path>/<file>` exists; run `sync-to-bucket.js`.
- **URLs show `%2520`** — something is double-encoding. `js/uqt.js` should call `encodeURI()` exactly once around the album path and filename (see commit `77f4c03`).
- **haloy deploy fails** — confirm `HALOY_API_TOKEN` is set and valid; `haloy status` will surface auth issues.

## Performance Notes

- Zero egress: both the haloy host and the bucket are in Hetzner HEL1.
- Latency overhead from the proxy hop is minimal.
- `Cache-Control: public, max-age=31536000` (one year) — safe because the app never mutates a given path.
- CORS enabled for all origins (`GET`, `HEAD`, `OPTIONS`).
- HTTP Range requests are forwarded, so audio scrubbing works.
