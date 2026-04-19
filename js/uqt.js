// State
let db;
let albums = [];
let filteredAlbums = [];
let selectedAlbum = null;
let currentTrack = null;
let activeDecade = null;
let searchQuery = '';
let shuffleOn = false;
let repeatMode = 'off'; // 'off' | 'one' | 'all'
let renderedAlbum = null;
const durationCache = new Map();

const BASE_URL = 'https://uqt.xn--2dk.xyz/uqt';
const failedCovers = new Set();
const PLACEHOLDER_COVER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Cdefs%3E%3ClinearGradient id="grad" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%232a2620;stop-opacity:1" /%3E%3Cstop offset="100%25" style="stop-color:%231a1814;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23grad)" width="200" height="200"/%3E%3Ccircle cx="100" cy="100" r="40" fill="none" stroke="%23d4a574" stroke-width="8"/%3E%3Ccircle cx="100" cy="100" r="15" fill="none" stroke="%23d4a574" stroke-width="2"/%3E%3Cpath d="M 100 60 Q 120 80 120 100 Q 120 125 100 140 Q 80 125 80 100 Q 80 80 100 60" fill="none" stroke="%23d4a574" stroke-width="3" stroke-linecap="round"/%3E%3C/svg%3E';

// ── Helpers ────────────────────────────────────────────────────────────────

function artistLinksHTML(str) {
  const parts = str.split(/(, | e | & |&)/);
  return parts.map((p, i) =>
    i % 2 === 0
      ? `<span class="artist-link" data-artist="${p.replace(/"/g, '&quot;')}">${p}</span>`
      : p
  ).join('');
}

function attachArtistHandlers(container) {
  container.querySelectorAll('.artist-link[data-artist]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const name = el.dataset.artist;
      const input = u('#search-input').first();
      input.value = name;
      searchQuery = name;
      activeDecade = null;
      document.querySelectorAll('.decade-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.decade-btn[data-decade="all"]')?.classList.add('active');
      filterAlbums();
      input.focus();
    });
  });
}

function checkMarquee(el) {
  if (!el) return;
  const existing = el.querySelector('.marquee-inner');
  if (existing) el.textContent = existing.textContent;
  el.classList.remove('marquee-active');
  el.style.removeProperty('--marquee-distance');
  el.style.removeProperty('--marquee-duration');

  requestAnimationFrame(() => {
    if (el.scrollWidth <= el.offsetWidth) return;
    const distance = el.offsetWidth - el.scrollWidth;
    const totalSeconds = Math.max(6, Math.abs(distance) / 50 / 0.75);
    el.style.setProperty('--marquee-distance', `${distance}px`);
    el.style.setProperty('--marquee-duration', `${totalSeconds.toFixed(1)}s`);
    const inner = document.createElement('span');
    inner.className = 'marquee-inner';
    inner.textContent = el.textContent;
    el.textContent = '';
    el.appendChild(inner);
    el.classList.add('marquee-active');
  });
}

function getAlbumFromUrl() {
  return new URLSearchParams(window.location.search).get('album');
}

function generateAlbumUrl(album) {
  const params = new URLSearchParams();
  params.set('album', album.path);
  return `${window.location.origin}${window.location.pathname}?${params}`;
}

function setMeta(attr, key, value) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', value);
}

function updateMetaTags(album) {
  const title = `${album.name} — ${album.artists} (${album.year})`;
  const desc = `Álbum de ${album.artists}, ${album.year}. Ouça no Acervo UQT.`;
  const image = `${BASE_URL}/${encodeURI(album.path)}/capa-min.jpg`;
  const url = generateAlbumUrl(album);
  document.title = `${album.name} · Acervo UQT`;
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', desc);
  setMeta('property', 'og:image', image);
  setMeta('property', 'og:url', url);
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', desc);
  setMeta('name', 'twitter:image', image);
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function loadCoverImage(imgElement, primaryUrl) {
  if (!primaryUrl) {
    imgElement.src = PLACEHOLDER_COVER;
    imgElement.classList.add('placeholder');
    return;
  }
  if (failedCovers.has(primaryUrl)) {
    imgElement.src = PLACEHOLDER_COVER;
    imgElement.classList.add('placeholder');
    return;
  }
  imgElement.classList.remove('placeholder');
  imgElement.src = primaryUrl;
  imgElement.onerror = () => {
    failedCovers.add(primaryUrl);
    imgElement.src = PLACEHOLDER_COVER;
    imgElement.classList.add('placeholder');
  };
}

function isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function openMobileDrawer()   { document.getElementById('mobile-track-drawer')?.classList.add('open'); }
function closeMobileDrawer()  { document.getElementById('mobile-track-drawer')?.classList.remove('open'); }
function toggleMobileDrawer() { document.getElementById('mobile-track-drawer')?.classList.toggle('open'); }

// ── Virtual Grid ──────────────────────────────────────────────────────────
// Renders only visible album cards; ~30 DOM nodes instead of 2,164.
// INFO_HEIGHT: item-gap(16) + title(~17) + info-gap(8) + meta(~16) = 57px

const INFO_HEIGHT = 57;

class VirtualGrid {
  constructor(container) {
    this.container = container;
    this.items = [];
    this.colCount = 1;
    this.itemWidth = 0;
    this.rowHeight = 0;
    this._padding = 24;
    this._gap = 24;
    this._nodes = new Map(); // index → DOM node

    this.inner = document.createElement('div');
    this.inner.className = 'albums-grid-inner';
    container.appendChild(this.inner);

    this._layout = this._layout.bind(this);
    this._render = this._render.bind(this);

    new ResizeObserver(this._layout).observe(container);
    container.addEventListener('scroll', this._render, { passive: true });
  }

  setItems(items) {
    this.items = items;
    this._nodes.clear();
    this.inner.replaceChildren();
    this.container.scrollTop = 0;
    this._layout();
  }

  refresh() {
    for (const [idx, node] of this._nodes) {
      node.classList.toggle('active', this.items[idx] === selectedAlbum);
    }
    this._render();
  }

  scrollToSelected() {
    if (!selectedAlbum) return;
    const idx = this.items.indexOf(selectedAlbum);
    if (idx < 0) return;
    const row = Math.floor(idx / this.colCount);
    this.container.scrollTop = this._padding + row * this.rowHeight;
  }

  _getConfig() {
    const w = this.container.clientWidth;
    if (w <= 480) return { minItem: 72, gap: 6,  padding: 6  };
    if (w <= 768) return { minItem: 80, gap: 8,  padding: 8  };
    return              { minItem: 140, gap: 24, padding: 24 };
  }

  _layout() {
    const { minItem, gap, padding } = this._getConfig();
    this._padding = padding;
    this._gap = gap;
    const usable = this.container.clientWidth - 2 * padding;
    this.colCount = Math.max(1, Math.floor((usable + gap) / (minItem + gap)));
    this.itemWidth = (usable - gap * (this.colCount - 1)) / this.colCount;
    this.rowHeight = this.itemWidth + INFO_HEIGHT + gap;

    const rows = Math.ceil(this.items.length / this.colCount);
    const totalH = rows > 0 ? rows * this.rowHeight - gap + 2 * padding : 0;
    this.inner.style.height = `${totalH}px`;

    // Flush stale nodes — surviving nodes carry old absolute positions from previous layout
    this._nodes.clear();
    this.inner.replaceChildren();

    this._render();
  }

  _makeNode(i) {
    const album = this.items[i];
    const { _padding: pad, _gap: gap } = this;
    const col = i % this.colCount;
    const row = Math.floor(i / this.colCount);

    const item = document.createElement('div');
    item.className = 'album-item';
    item.dataset.albumIdx = i;
    if (selectedAlbum === album) item.classList.add('active');
    item.style.cssText = `position:absolute;width:${this.itemWidth}px;top:${pad + row * this.rowHeight}px;left:${pad + col * (this.itemWidth + gap)}px`;

    const cover = document.createElement('img');
    cover.className = 'album-cover-thumb';
    cover.alt = album.name;
    loadCoverImage(cover, album.cover);

    const info = document.createElement('div');
    info.className = 'album-item-info';
    const title = document.createElement('div');
    title.className = 'album-item-title';
    title.textContent = album.name;
    const meta = document.createElement('div');
    meta.className = 'album-item-meta';
    meta.textContent = `${album.artists} • ${album.year || '∞'}`;

    info.append(title, meta);
    item.append(cover, info);
    return item;
  }

  _render() {
    const { _padding: pad, _gap: gap } = this;
    const scrollTop = this.container.scrollTop;
    const viewH = this.container.clientHeight;
    const BUFFER = 2;

    const startRow = Math.max(0, Math.floor((scrollTop - pad) / this.rowHeight) - BUFFER);
    const endRow   = Math.ceil((scrollTop + viewH - pad) / this.rowHeight) + BUFFER;
    const startIdx = startRow * this.colCount;
    const endIdx   = Math.min(this.items.length, endRow * this.colCount);

    // Remove nodes that scrolled out of range
    for (const [idx, node] of this._nodes) {
      if (idx < startIdx || idx >= endIdx) {
        node.remove();
        this._nodes.delete(idx);
      }
    }

    // Add nodes that scrolled into range
    for (let i = startIdx; i < endIdx; i++) {
      if (!this._nodes.has(i)) {
        const node = this._makeNode(i);
        this._nodes.set(i, node);
        this.inner.appendChild(node);
      }
    }
  }
}

let virtualGrid = null;

// ── Data ──────────────────────────────────────────────────────────────────

function buildAlbums() {
  albums = db.albums.map(album => ({
    name: album.title,
    artists: album.artist,
    year: album.year,
    path: album.path,
    cover: album.has_cover !== false ? `${BASE_URL}/${encodeURI(album.path)}/capa-min.jpg` : null,
    tracks: album.tracks.map(track => {
      const file = `${encodeURI(album.path)}/${encodeURI(track.file)}`;
      if (track.duration) durationCache.set(file, track.duration);
      return { title: track.title, num: track.num, file, album: album.title, artists: track.artists || album.artist, year: album.year };
    })
  }));
  albums.sort((a, b) => b.year - a.year);
  return albums;
}

// ── Filtering ─────────────────────────────────────────────────────────────

function getDecades() {
  const decades = new Set(albums.map(a => Math.floor(a.year / 10) * 10).filter(d => d >= 1950));
  return Array.from(decades).sort((a, b) => a - b);
}

function filterAlbums() {
  filteredAlbums = albums.filter(album => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      album.name?.toLowerCase().includes(q) ||
      album.artists?.toLowerCase().includes(q) ||
      album.path?.toLowerCase().includes(q) ||
      album.tracks.some(t => t.title?.toLowerCase().includes(q) || t.artists?.toLowerCase().includes(q));
    const matchesDecade = activeDecade === null ||
      (activeDecade === 'noyear' ? !album.year :
      activeDecade === 'pre1940' ? album.year < 1950 : Math.floor(album.year / 10) * 10 === activeDecade);
    return matchesSearch && matchesDecade;
  });
  virtualGrid.setItems(filteredAlbums);
  updateLibraryStats();

  const countEl = document.getElementById('search-count');
  const clearBtn = document.getElementById('search-clear');
  const isFiltered = !!searchQuery || activeDecade !== null;
  if (countEl) {
    countEl.textContent = `${filteredAlbums.length} álbun${filteredAlbums.length !== 1 ? 's' : ''}`;
    countEl.classList.toggle('visible', isFiltered);
  }
  if (clearBtn) clearBtn.classList.toggle('visible', !!searchQuery);
}

function updateLibraryStats() {
  const totalAlbums = filteredAlbums.length;
  const totalArtists = new Set(filteredAlbums.map(a => a.artists).filter(Boolean)).size;
  u('#mobile-stat-albums').text(`${totalAlbums} álbun${totalAlbums !== 1 ? 's' : ''}`);
  u('#mobile-stat-artists').text(`${totalArtists} artista${totalArtists !== 1 ? 's' : ''}`);
}

// ── Decade Buttons (rendered once on init) ────────────────────────────────

function renderDecadeButtons() {
  const decades = getDecades();
  const container = document.querySelector('#decade-buttons');

  const todosBtn = document.createElement('button');
  todosBtn.className = 'decade-btn active';
  todosBtn.textContent = 'Todos';
  todosBtn.dataset.decade = 'all';
  todosBtn.addEventListener('click', () => {
    activeDecade = null;
    searchQuery = '';
    u('#search-input').first().value = '';
    filterAlbums();
    container.querySelectorAll('.decade-btn').forEach(b => b.classList.remove('active'));
    todosBtn.classList.add('active');
  });

  const frag = document.createDocumentFragment();
  frag.append(todosBtn);

  const pre1940Btn = document.createElement('button');
  pre1940Btn.className = 'decade-btn';
  pre1940Btn.textContent = '<1940';
  pre1940Btn.dataset.decade = 'pre1940';
  pre1940Btn.title = '1900–1949';
  pre1940Btn.addEventListener('click', () => {
    activeDecade = 'pre1940';
    searchQuery = '';
    u('#search-input').first().value = '';
    filterAlbums();
    container.querySelectorAll('.decade-btn').forEach(b => b.classList.remove('active'));
    pre1940Btn.classList.add('active');
  });
  frag.append(pre1940Btn);

  decades.forEach(decade => {
    const btn = document.createElement('button');
    btn.className = 'decade-btn';
    btn.textContent = `${decade}`;
    btn.dataset.decade = decade;
    btn.title = `${decade}–${decade + 9}`;
    btn.addEventListener('click', () => {
      activeDecade = parseInt(btn.dataset.decade);
      searchQuery = '';
      u('#search-input').first().value = '';
      filterAlbums();
      container.querySelectorAll('.decade-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    frag.append(btn);
  });

  if (albums.some(a => !a.year)) {
    const infBtn = document.createElement('button');
    infBtn.className = 'decade-btn';
    infBtn.textContent = '∞';
    infBtn.dataset.decade = 'noyear';
    infBtn.title = 'Sem data';
    infBtn.addEventListener('click', () => {
      activeDecade = 'noyear';
      searchQuery = '';
      u('#search-input').first().value = '';
      filterAlbums();
      container.querySelectorAll('.decade-btn').forEach(b => b.classList.remove('active'));
      infBtn.classList.add('active');
    });
    frag.append(infBtn);
  }

  container.replaceChildren(frag);
}

// ── Track & Album Header Rendering ───────────────────────────────────────

function renderAlbumHeader() {
  const container = u('#album-header').first();
  if (!selectedAlbum) { container.innerHTML = ''; return; }

  const cover = document.createElement('img');
  cover.className = 'album-cover-large';
  cover.alt = selectedAlbum.name;
  cover.loading = 'lazy';
  loadCoverImage(cover, selectedAlbum.cover);

  const info = document.createElement('div');
  info.className = 'album-header-info';
  info.innerHTML = `
    <h2>${selectedAlbum.name}</h2>
    <p><strong>${artistLinksHTML(selectedAlbum.artists)}</strong></p>
    <p>${selectedAlbum.year} • ${selectedAlbum.tracks.length} canções</p>
  `;

  attachArtistHandlers(info);
  container.replaceChildren(cover, info);
}

function updateDurationInDOM(track, idx) {
  const dur = durationCache.get(track.file);
  if (!dur) return;
  const formatted = formatTime(dur);
  document.querySelector(`#track-list [data-track-idx="${idx}"] .track-duration`)?.replaceChildren(document.createTextNode(formatted));
  document.querySelector(`#drawer-track-list [data-track-idx="${idx}"] .track-duration`)?.replaceChildren(document.createTextNode(formatted));
}

function renderTrackList() {
  const container = document.querySelector('#track-list');
  const tracksPanel = u('.tracks-panel').first();

  if (!selectedAlbum) {
    tracksPanel.classList.add('hidden');
    container.replaceChildren();
    renderedAlbum = null;
    return;
  }

  tracksPanel.classList.remove('hidden');

  if (renderedAlbum === selectedAlbum) {
    container.querySelectorAll('[data-track-idx]').forEach(item => {
      item.classList.toggle('playing',
        selectedAlbum.tracks[parseInt(item.dataset.trackIdx)] === currentTrack);
    });
    container.querySelector('.track-item.playing')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return;
  }

  tracksPanel.scrollTop = 0;
  const frag = document.createDocumentFragment();

  selectedAlbum.tracks.forEach((track, idx) => {
    const item = document.createElement('li');
    item.className = 'track-item';
    item.dataset.trackIdx = idx;
    if (currentTrack === track) item.classList.add('playing');

    const artistName = track.artists && track.artists !== selectedAlbum.artists ? track.artists : '';
    const artistLabel = artistName ? `<div class="track-artist">${artistLinksHTML(artistName)}</div>` : '';
    const dur = durationCache.has(track.file) ? formatTime(durationCache.get(track.file)) : '-';
    item.innerHTML = `
      <span class="track-num">${track.num}</span>
      <div class="track-details">
        <div class="track-title">${track.title}</div>
        ${artistLabel}
      </div>
      <span class="track-duration">${dur}</span>
    `;
    if (artistName) attachArtistHandlers(item);
    frag.append(item);
  });

  container.replaceChildren(frag);
  renderedAlbum = selectedAlbum;
  container.querySelector('.track-item.playing')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}


// ── Playback ──────────────────────────────────────────────────────────────

function safePlay(audio) {
  const p = audio.play();
  if (p?.catch) p.catch(err => {
    if (err.name !== 'AbortError' && err.name !== 'NotAllowedError')
      console.error('audio.play() failed:', err);
  });
}

function playTrack(track) {
  currentTrack = track;
  updateNowPlaying();
  const audio = u('#audio').first();
  const newSrc = `${BASE_URL}/${track.file}`;
  if (audio.src !== newSrc) { audio.src = newSrc; audio.load(); }
  safePlay(audio);
  u('#btn-play').addClass('playing');
  renderTrackList();
  syncDrawerPlayingState();
}

function renderMobileDrawer(album) {
  const titleEl = document.getElementById('drawer-album-title');
  const metaEl  = document.getElementById('drawer-album-meta');
  const coverEl = document.getElementById('drawer-cover');
  const listEl  = document.getElementById('drawer-track-list');

  if (!album) {
    if (titleEl) titleEl.textContent = '';
    if (metaEl)  metaEl.textContent  = '';
    if (listEl)  listEl.replaceChildren();
    return;
  }

  if (titleEl) titleEl.textContent = album.name;
  if (metaEl)  metaEl.textContent  = `${album.artists} · ${album.year} · ${album.tracks.length} faixas`;
  if (coverEl) loadCoverImage(coverEl, album.cover);
  if (!listEl) return;

  const frag = document.createDocumentFragment();
  album.tracks.forEach((track, idx) => {
    const item = document.createElement('li');
    item.className = 'track-item';
    item.dataset.trackIdx = idx;
    if (currentTrack === track) item.classList.add('playing');

    const artistName = track.artists && track.artists !== album.artists ? track.artists : '';
    const artistLabel = artistName ? `<div class="track-artist">${artistLinksHTML(artistName)}</div>` : '';
    const dur = durationCache.has(track.file) ? formatTime(durationCache.get(track.file)) : '-';
    item.innerHTML = `
      <span class="track-num">${track.num}</span>
      <div class="track-details">
        <div class="track-title">${track.title}</div>
        ${artistLabel}
      </div>
      <span class="track-duration">${dur}</span>
    `;
    if (artistName) attachArtistHandlers(item);
    frag.append(item);
  });

  listEl.replaceChildren(frag);
}

function syncDrawerPlayingState() {
  const listEl = document.getElementById('drawer-track-list');
  if (!listEl || !selectedAlbum) return;
  listEl.querySelectorAll('[data-track-idx]').forEach(item => {
    const track = selectedAlbum.tracks[parseInt(item.dataset.trackIdx)];
    item.classList.toggle('playing', track === currentTrack);
    if (track === currentTrack) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function updateNowPlaying() {
  if (!currentTrack) return;
  u('#player-title').text(currentTrack.title);
  u('#player-artist').text(currentTrack.artists);
  const folder = currentTrack.file.split('/')[0];
  const coverUrl = `${BASE_URL}/${folder}/capa-min.jpg`;
  const coverImg = u('#player-cover').first();
  if (coverImg) { coverImg.loading = 'lazy'; loadCoverImage(coverImg, coverUrl); }
  const drawerCover = document.getElementById('drawer-cover');
  if (drawerCover) loadCoverImage(drawerCover, coverUrl);
  // Overlay
  const overlayCover = document.getElementById('overlay-cover');
  if (overlayCover) loadCoverImage(overlayCover, coverUrl);
  const overlayTitle = document.getElementById('overlay-track-title');
  if (overlayTitle) overlayTitle.textContent = currentTrack.title;
  const overlayArtist = document.getElementById('overlay-track-artist');
  if (overlayArtist) overlayArtist.textContent = currentTrack.artists;

  // Media Session
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artists,
      album: currentTrack.album || '',
      artwork: [{ src: coverUrl, sizes: '200x200', type: 'image/jpeg' }]
    });
  }

  checkMarquee(document.getElementById('player-title'));
  checkMarquee(document.getElementById('overlay-track-title'));
}

function playNext() {
  if (shuffleOn) {
    if (!albums.length) return;
    const pool = albums.flatMap(a => a.tracks.map(t => ({ track: t, album: a }))).filter(({ track }) => track !== currentTrack);
    if (!pool.length) return;
    const { track, album: nextAlbum } = pool[Math.floor(Math.random() * pool.length)];
    if (nextAlbum !== selectedAlbum) {
      selectedAlbum = nextAlbum;
      renderedAlbum = null;
      renderAlbumHeader();
      renderTrackList();
      renderMobileDrawer(nextAlbum);
      virtualGrid.refresh();
      updateMetaTags(nextAlbum);
      window.history.pushState({ album: nextAlbum.path }, '', generateAlbumUrl(nextAlbum));
    }
    playTrack(track);
    return;
  }
  if (!selectedAlbum || !currentTrack) return;
  const tracks = selectedAlbum.tracks;
  const idx = tracks.findIndex(t => t.num === currentTrack.num);
  if (idx < tracks.length - 1) {
    playTrack(tracks[idx + 1]);
  } else if (repeatMode === 'all') {
    playTrack(tracks[0]);
  }
}

function playPrevious() {
  if (!selectedAlbum || !currentTrack) return;
  const idx = selectedAlbum.tracks.findIndex(t => t.num === currentTrack.num);
  if (idx > 0) playTrack(selectedAlbum.tracks[idx - 1]);
}

// ── Init ──────────────────────────────────────────────────────────────────

u(document).on('DOMContentLoaded', async function () {
  const albumsList = document.querySelector('#albums-list');

  // Delegated click: album grid
  albumsList.addEventListener('click', e => {
    const item = e.target.closest('[data-album-idx]');
    if (!item) return;
    const album = filteredAlbums[parseInt(item.dataset.albumIdx)];
    if (!album || selectedAlbum === album) return;

    albumsList.querySelector('.album-item.active')?.classList.remove('active');
    item.classList.add('active');

    selectedAlbum = album;
    renderedAlbum = null;
    renderAlbumHeader();
    renderTrackList();
    renderMobileDrawer(album);
    if (isMobile()) openMobileDrawer();

    if (album.tracks.length > 0) {
      const audio = u('#audio').first();
      if (audio.paused) {
        currentTrack = album.tracks[0];
        updateNowPlaying();
        const newSrc = `${BASE_URL}/${currentTrack.file}`;
        if (audio.src !== newSrc) { audio.src = newSrc; audio.load(); }
      }
    }

    updateMetaTags(album);
    window.history.pushState({ album: album.path }, '', generateAlbumUrl(album));
  });

  // Browser back/forward: restore album selection from history state
  window.addEventListener('popstate', (e) => {
    const path = e.state?.album ?? new URLSearchParams(window.location.search).get('album');
    if (!path) return;
    const album = albums.find(a => a.path === path);
    if (!album || album === selectedAlbum) return;
    albumsList.querySelector('.album-item.active')?.classList.remove('active');
    selectedAlbum = album;
    renderedAlbum = null;
    virtualGrid.refresh();
    virtualGrid.scrollToSelected();
    renderAlbumHeader();
    renderTrackList();
    renderMobileDrawer(album);
    updateMetaTags(album);
  });

  // Delegated click: desktop track list
  document.querySelector('#track-list').addEventListener('click', e => {
    const item = e.target.closest('[data-track-idx]');
    if (item && selectedAlbum) playTrack(selectedAlbum.tracks[parseInt(item.dataset.trackIdx)]);
  });


// Show loading skeleton
  const skeletonEl = document.createElement('div');
  skeletonEl.className = 'grid-skeleton';
  for (let i = 0; i < 30; i++) {
    const card = document.createElement('div');
    card.className = 'skeleton-card';
    skeletonEl.append(card);
  }
  albumsList.append(skeletonEl);

  // Init virtual grid before data loads so it sizes correctly
  virtualGrid = new VirtualGrid(albumsList);

  // Async data: fetch gzipped JSON, decompress with native DecompressionStream
  const json = await new Response(
    (await fetch('js/uqt-albums.json.gz')).body.pipeThrough(new DecompressionStream('gzip'))
  ).text();
  db = JSON.parse(json);
  skeletonEl.remove();

  buildAlbums();
  filteredAlbums = [...albums];
  renderDecadeButtons();
  virtualGrid.setItems(filteredAlbums);
  updateLibraryStats();

  // Select initial album from URL or first in list
  const albumFromUrl = getAlbumFromUrl();
  let albumToSelect = albumFromUrl ? albums.find(a => a.path === albumFromUrl) : null;
  if (!albumToSelect && filteredAlbums.length > 0) albumToSelect = filteredAlbums[0];

  if (albumToSelect) {
    selectedAlbum = albumToSelect;
    virtualGrid.setItems(filteredAlbums);
    virtualGrid.scrollToSelected();
    renderAlbumHeader();
    renderTrackList();
    renderMobileDrawer(albumToSelect);
    if (albumFromUrl && isMobile()) openMobileDrawer();
    updateMetaTags(albumToSelect);
    window.history.replaceState({ album: albumToSelect.path }, '', generateAlbumUrl(albumToSelect));
  }

  const playerCover = u('#player-cover').first();
  if (playerCover && !playerCover.src) {
    playerCover.src = PLACEHOLDER_COVER;
    playerCover.classList.add('placeholder');
  }

  const audio = u('#audio').first();

  const overlayBtnPlay = document.getElementById('overlay-btn-play');
  const setLoading = on => {
    document.getElementById('btn-play')?.classList.toggle('loading', on);
    overlayBtnPlay?.classList.toggle('loading', on);
  };

  audio.addEventListener('play',     () => { u('#btn-play').addClass('playing');    overlayBtnPlay?.classList.add('playing'); });
  audio.addEventListener('pause',    () => { u('#btn-play').removeClass('playing'); overlayBtnPlay?.classList.remove('playing'); });
  audio.addEventListener('waiting',  () => setLoading(true));
  audio.addEventListener('stalled',  () => setLoading(true));
  audio.addEventListener('canplay',  () => setLoading(false));
  audio.addEventListener('playing',  () => setLoading(false));
  audio.addEventListener('error',    () => setLoading(false));

  const progressFill = document.querySelector('#progress-fill');
  const mainProgressBar = document.getElementById('main-progress-bar');
  const overlayProgressFill = document.getElementById('overlay-progress-fill');
  const overlayTimeCurrent = document.getElementById('overlay-time-current');
  const overlayTimeDuration = document.getElementById('overlay-time-duration');

  audio.addEventListener('timeupdate', () => {
    const percent = (audio.currentTime / audio.duration) * 100 || 0;
    const cur = formatTime(audio.currentTime);
    progressFill.style.width = percent + '%';
    mainProgressBar.classList.toggle('has-progress', percent > 0);
    u('#time-current').text(cur);
    if (overlayProgressFill) overlayProgressFill.style.width = percent + '%';
    if (overlayTimeCurrent) overlayTimeCurrent.textContent = cur;
    if ('mediaSession' in navigator && audio.duration && !isNaN(audio.duration)) {
      try { navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate, position: audio.currentTime }); } catch (_) {}
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    const dur = formatTime(audio.duration);
    u('#time-duration').text(dur);
    if (overlayTimeDuration) overlayTimeDuration.textContent = dur;
    if (currentTrack) {
      durationCache.set(currentTrack.file, audio.duration);
      if (selectedAlbum) {
        const idx = selectedAlbum.tracks.indexOf(currentTrack);
        if (idx >= 0) updateDurationInDOM(currentTrack, idx);
      }
    }
  });

  audio.addEventListener('ended', playNext);

  u('#btn-play').on('click', function () {
    if (audio.paused) {
      if (!currentTrack) {
        if (selectedAlbum?.tracks.length > 0) {
          playTrack(selectedAlbum.tracks[0]);
        } else if (filteredAlbums.length > 0) {
          selectedAlbum = filteredAlbums[0];
          virtualGrid.refresh();
          renderAlbumHeader();
          renderTrackList();
          playTrack(selectedAlbum.tracks[0]);
        }
      } else {
        safePlay(audio);
        u('#btn-play').addClass('playing');
      }
    } else {
      if (selectedAlbum && currentTrack && !selectedAlbum.tracks.includes(currentTrack)) {
        playTrack(selectedAlbum.tracks[0]);
      } else {
        audio.pause();
      }
    }
  });

  u('#btn-prev').on('click', playPrevious);
  u('#btn-next').on('click', playNext);

  // Mobile now-playing overlay
  const overlay = document.getElementById('now-playing-overlay');
  const overlayProgressBar = document.getElementById('overlay-progress-bar');
  document.querySelector('.now-playing-compact')?.addEventListener('click', () => {
    if (isMobile() && currentTrack) overlay?.classList.add('open');
  });
  document.getElementById('overlay-close')?.addEventListener('click', () => overlay?.classList.remove('open'));
  document.getElementById('overlay-btn-prev')?.addEventListener('click', playPrevious);
  document.getElementById('overlay-btn-next')?.addEventListener('click', playNext);
  overlayBtnPlay?.addEventListener('click', () => document.getElementById('btn-play').click());

  // Media Session action handlers
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => safePlay(audio));
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('previoustrack', playPrevious);
    navigator.mediaSession.setActionHandler('nexttrack', playNext);
    navigator.mediaSession.setActionHandler('seekbackward', ({ seekOffset = 10 }) => { audio.currentTime = Math.max(0, audio.currentTime - seekOffset); });
    navigator.mediaSession.setActionHandler('seekforward', ({ seekOffset = 10 }) => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + seekOffset); });
    navigator.mediaSession.setActionHandler('seekto', ({ seekTime }) => { audio.currentTime = seekTime; });
  }

  document.getElementById('drawer-close')?.addEventListener('click', closeMobileDrawer);
  document.getElementById('btn-tracklist')?.addEventListener('click', toggleMobileDrawer);

  const btnShuffle = document.getElementById('btn-shuffle');
  const btnRepeat = document.getElementById('btn-repeat');
  const volumeSlider = document.getElementById('volume-slider');

  function applyRepeatMode(mode) {
    repeatMode = mode;
    audio.loop = (mode === 'one');
    btnRepeat?.classList.toggle('active', mode !== 'off');
    const titles = { off: 'Repetir', one: 'Repetir faixa', all: 'Repetir álbum' };
    if (btnRepeat) btnRepeat.title = titles[mode];
    localStorage.setItem('uqt-repeat', mode);
  }

  // Restore persisted state
  shuffleOn = localStorage.getItem('uqt-shuffle') === 'true';
  btnShuffle?.classList.toggle('active', shuffleOn);
  applyRepeatMode(localStorage.getItem('uqt-repeat') || 'off');
  const savedVolume = parseFloat(localStorage.getItem('uqt-volume') ?? '1');
  if (volumeSlider) volumeSlider.value = savedVolume;
  audio.volume = savedVolume;
  if (savedVolume === 0) document.getElementById('volume-wave').style.display = 'none';

  btnShuffle?.addEventListener('click', () => {
    shuffleOn = !shuffleOn;
    btnShuffle.classList.toggle('active', shuffleOn);
    localStorage.setItem('uqt-shuffle', shuffleOn);
  });

  btnRepeat?.addEventListener('click', () => {
    applyRepeatMode(repeatMode === 'off' ? 'one' : repeatMode === 'one' ? 'all' : 'off');
  });

  volumeSlider?.addEventListener('input', () => {
    const vol = parseFloat(volumeSlider.value);
    audio.volume = vol;
    document.getElementById('volume-wave').style.display = vol === 0 ? 'none' : '';
    localStorage.setItem('uqt-volume', vol);
  });

  function seekFromClient(clientX, barEl) {
    if (!audio.duration) return;
    const rect = barEl.getBoundingClientRect();
    audio.currentTime = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * audio.duration;
  }

  [mainProgressBar, overlayProgressBar].forEach(bar => {
    if (!bar) return;
    bar.addEventListener('click', e => seekFromClient(e.clientX, bar));
    bar.addEventListener('touchstart', e => { e.preventDefault(); seekFromClient(e.touches[0].clientX, bar); }, { passive: false });
    bar.addEventListener('touchmove',  e => { e.preventDefault(); seekFromClient(e.touches[0].clientX, bar); }, { passive: false });
  });

  const playerTitleEl = document.getElementById('player-title');
  if (playerTitleEl && window.ResizeObserver) {
    new ResizeObserver(() => {
      if (currentTrack) checkMarquee(playerTitleEl);
    }).observe(playerTitleEl.closest('.player-info'));
  }

  let searchDebounce;
  u('#search-input').on('input', function () {
    searchQuery = this.value;
    if (searchQuery) {
      activeDecade = null;
      document.querySelectorAll('.decade-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.decade-btn[data-decade="all"]')?.classList.add('active');
    }
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(filterAlbums, 150);
  });

  document.getElementById('search-clear')?.addEventListener('click', () => {
    searchQuery = '';
    u('#search-input').first().value = '';
    filterAlbums();
    u('#search-input').first().focus();
  });

  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, [contenteditable]')) return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        document.getElementById('btn-play').click();
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (audio.duration) audio.currentTime = Math.max(0, audio.currentTime - 10);
        break;
      case 'n':
        if (!e.metaKey && !e.ctrlKey && !e.altKey) playNext();
        break;
      case 'p':
        if (!e.metaKey && !e.ctrlKey && !e.altKey) playPrevious();
        break;
      case '/':
        e.preventDefault();
        u('#search-input').first().focus();
        break;
    }
  });
});
