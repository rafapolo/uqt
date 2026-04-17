# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**UQT** is a web app for browsing and streaming a large archive of Brazilian music (MPB — Música Popular Brasileira). The app displays ~700 hours of music organized by artist and decade, with album artwork and full playback controls.

## Architecture

### Frontend
- **index.html** — Main web app
- **js/uqt.js** — Core app logic: album/track rendering, playback control, search/filtering
- **js/uqt-albums.js** — Metadata database (album-centric: title, artist, year, path, tracks)
- **uqt.css** — Styling

The app loads metadata from the JSON file at page load. Album paths in the JSON map directly to file paths on the audio server.

### Backend/Infrastructure
- **proxy.js** — Node.js reverse proxy listening on port 9001. Forwards all requests under `/uqt/*` to Hetzner S3 bucket `your-objectstorage-endpoint/sambaraiz`. Sets correct `Content-Type` headers (audio/mpeg for .mp3, image/jpeg for .jpg, etc.) and CORS headers to prevent CORB blocking.
- **haloy.yaml** — Deployment config; deploys proxy to uqt.xn--2dk.xyz
- **Dockerfile** — Packages proxy.js for haloy deployment

### Data Flow
1. App loads HTML → loads js/uqt-albums.js to populate UI
2. User clicks album → primes first track (loads audio src, updates player) without auto-playing; user presses play to start
3. User clicks play → constructs URL: `https://uqt.xn--2dk.xyz/uqt/{encoded_album_path}/{encoded_track_file}`
4. Proxy receives request, forwards to S3: `https://sambaraiz.../sambaraiz/uqt/{path}`
5. S3 returns file with headers set by proxy

## Key Technical Notes

- **URL Encoding**: Album paths and filenames are encoded with `encodeURI()` in `buildAlbums()` in js/uqt.js when constructing `track.file` and `album.cover`. The proxy forwards encoded paths as-is to S3. S3 stores files with literal spaces (no %20).
- **Cover images**: Served as `capa-min.jpg` (200px wide, ~10KB) resized from original `capa.jpg` via `js/resize-cover-images.js`. All img elements use `loading="lazy"`. SVG placeholder shown when cover missing.
- **Album selection**: Clicking an album primes the first track (sets `audio.src`, calls `audio.load()`, updates player UI) without auto-playing. Play button starts audio.
- **CORS**: The proxy adds CORS headers to all responses; app runs cross-origin from haloy.
- **Content-Type**: Proxy explicitly sets correct MIME types to prevent CORB (Cross-Origin Read Blocking) errors in browsers.
- **S3 bucket policy**: `sambaraiz` allows public `GetObject` on `*` and `PutObject`/`DeleteObject` on `uqt/*` for the service account key.

## Common Development Tasks

### Testing the Proxy Locally
```bash
node proxy.js
# Listens on http://localhost:9001
# Test: curl -I http://localhost:9001/health
```

The proxy will forward requests to the live S3 bucket (sambaraiz), so you need S3 files present to test audio/cover playback.

### Regenerating Album Database
When MP3 files are added/updated in `unzips/`, regenerate the JSON database:
```bash
node generate-albums.js
```

This reads MP3 metadata from all files in `unzips/` and outputs `js/uqt-albums.js` (album-centric structure).

**Requirements:** `ffprobe` (from ffmpeg package). On macOS:
```bash
brew install ffmpeg
```

### Data Schema (`js/uqt-albums.js`)
Album-centric format: `db = {"albums": [...]}`
```json
{
  "title": "Album Title",
  "artist": "Artist Name or \"Various Artists\" for compilations",
  "year": 2009,
  "path": "2009 - Artist Name - Album",
  "tracks": [
    {
      "title": "Track Title",
      "num": 1,
      "file": "01 Track Title.mp3",
      "artists": "Track artist credit"
    }
  ]
}
```

Album `path` is used to construct URLs: the proxy expects files at `s3://sambaraiz/uqt/{path}/{filename}`.

### Resizing and Uploading Cover Images
When new albums are added, generate and upload resized covers (200px wide) to S3:
```bash
node js/resize-cover-images.js
```
Requires `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in `.env` with write access to `sambaraiz/uqt/*`. Source covers read from `/Volumes/EXTRA/bkps/sambaderaiz`. Skips albums already uploaded.

### Deploying to Haloy
```bash
haloy deploy
```
Requires `HALOY_API_TOKEN` env var. Deploys proxy.js + Dockerfile to uqt.xn--2dk.xyz.

## S3 Sync Status

Audio files and cover images are synced to the S3 bucket (`your-objectstorage-endpoint/sambaraiz/uqt/`). This is an ongoing process. Until files are fully synced, audio playback will return 404. Expected paths are:
- `sambaraiz/uqt/{album_path}/{track_file}` (e.g., `sambaraiz/uqt/2009 - Artist - Album/01 Track.mp3`)
- `sambaraiz/uqt/{album_path}/capa-min.jpg` (cover image, resized 200px width)

## Recent Fixes

- **Mobile rethink**: Compact 44px header; album grid takes full height; `.tracks-panel` hidden on mobile; slide-up track drawer embedded in player bar (☰ toggle); player is a single 64px row.
- **Player controls**: Shuffle (random next track within album), repeat (`audio.loop`), and volume slider added to desktop player bar. Play button uses SVG icons that swap between play/pause states.
- **Track artist label**: Track artist shown in gray below track title when it differs from album artist (useful for compilations).
- **Header stats**: Album/artist counts moved from player bar into header as accent pills, visible on all screen sizes in a single row alongside "705 horas".
- **Cover resize upload**: Fixed `resize-cover-images.js` — rewrote to use AWS SDK directly with proper error surfacing. Fixed bucket policy to allow PutObject on `uqt/*`.
- **Album-centric restructure**: Changed from artist-keyed to album-keyed data structure. Merged 211 duplicate compilation albums. Replaced `uqt.rb` with `generate-albums.js`.

## Troubleshooting

**Audio returns 404**: Check if files exist on S3 at `your-objectstorage-endpoint/sambaraiz/uqt/{path}`. If sync is incomplete, files may not be available yet.

**Proxy not routing through haloy**: Haloy deployment requires valid `HALOY_API_TOKEN`. Verify with `haloy status` (will error if token is missing).

**App doesn't show albums**: Check browser console for errors loading js/uqt-albums.js. Verify the JSON file is valid and contains expected `db = {...}` definition. Regenerate with `node generate-albums.js`.
