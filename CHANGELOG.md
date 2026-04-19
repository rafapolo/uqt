# Changelog

2026-04-19

- 3D albums view

2026-04-18

- Expand catalog to 1,658 hours; improve virtual grid and mobile drawer
- Bake track durations into JSON; fix shared-URL mobile drawer
- Media session API, cross-album shuffle, skeleton loading, touch seek
- Mobile now-playing overlay with SVG controls
- Search clear button, Spotify-style progress bar, keyboard shortcuts, repeat modes, localStorage
persistence
- Switch deploy workflow to Bun
- Replace pako with native DecompressionStream; add search debounce
- Async gzip data loading with virtual scrolling

2026-04-17

- Open Graph / Twitter Card meta tags for shared album links
- Show track artist in gray below title for compilations
- Shuffle, repeat, volume controls in desktop player bar
- SVG play/pause toggle button
- Header stats (albums, artists, hours) in single responsive row
- Rethink mobile layout: compact header, full-height grid, slide-up track drawer
- Fix lazy loading for cover images; scroll track list to top on album change
- Remove auto-play on album select (prime only)
- Lazy loading for album covers

2026-04-16

- Album-centric data model restructure
- Shareable album URLs with copy-to-clipboard share button
- Update browser URL when album is selected
- Vinyl record SVG favicon
- Spotify-style album grid redesign with metadata improvements
- Haloy deployment with Docker support (uqt.xn--2dk.xyz)
- Hetzner reverse proxy for zero-egress audio streaming
- Fix CORB via proper CORS and MIME type handling in proxy

2026-04-15

- Redesign to Spotify-style album view with side-by-side layout
- Modern responsive interface with custom player controls
- Stream through Nginx proxy to avoid egress fees

2020-07-08  

- Initial sketch
