// State
let db;
let albums = [];
let filteredAlbums = [];
let selectedAlbum = null;
let currentTrack = null;
let activeDecade = null;
let searchQuery = '';
let shuffleOn = false;
let repeatOn = false;
let renderedAlbum = null;

const BASE_URL = 'https://uqt.xn--2dk.xyz/uqt';
const PLACEHOLDER_COVER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Cdefs%3E%3ClinearGradient id="grad" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%232a2620;stop-opacity:1" /%3E%3Cstop offset="100%25" style="stop-color:%231a1814;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23grad)" width="200" height="200"/%3E%3Ccircle cx="100" cy="100" r="40" fill="none" stroke="%23d4a574" stroke-width="8"/%3E%3Ccircle cx="100" cy="100" r="15" fill="none" stroke="%23d4a574" stroke-width="2"/%3E%3Cpath d="M 100 60 Q 120 80 120 100 Q 120 125 100 140 Q 80 125 80 100 Q 80 80 100 60" fill="none" stroke="%23d4a574" stroke-width="3" stroke-linecap="round"/%3E%3C/svg%3E';

// ── Helpers ────────────────────────────────────────────────────────────────

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
  imgElement.classList.remove('placeholder');
  imgElement.src = primaryUrl;
  imgElement.onerror = () => {
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
    this.container.scrollTop = 0;
    this._layout();
  }

  refresh() {
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

    this._render();
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

    const frag = document.createDocumentFragment();

    for (let i = startIdx; i < endIdx; i++) {
      const album = this.items[i];
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
      cover.loading = 'lazy';
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
      frag.append(item);
    }

    this.inner.replaceChildren(frag);
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
    cover: `${BASE_URL}/${encodeURI(album.path)}/capa-min.jpg`,
    tracks: album.tracks.map(track => ({
      title: track.title,
      num: track.num,
      file: `${encodeURI(album.path)}/${encodeURI(track.file)}`,
      album: album.title,
      artists: track.artists || album.artist,
      year: album.year
    }))
  }));
  albums.sort((a, b) => b.year - a.year);
  return albums;
}

// ── Filtering ─────────────────────────────────────────────────────────────

function getDecades() {
  const decades = new Set(albums.map(a => Math.floor(a.year / 10) * 10));
  return Array.from(decades).sort((a, b) => a - b);
}

function filterAlbums() {
  filteredAlbums = albums.filter(album => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      album.name?.toLowerCase().includes(q) ||
      album.artists?.toLowerCase().includes(q) ||
      album.path?.toLowerCase().includes(q) ||
      album.tracks.some(t => t.artists?.toLowerCase().includes(q));
    const matchesDecade = activeDecade === null ||
      Math.floor(album.year / 10) * 10 === activeDecade;
    return matchesSearch && matchesDecade;
  });
  virtualGrid.setItems(filteredAlbums);
  updateLibraryStats();
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

  decades.forEach(decade => {
    const btn = document.createElement('button');
    btn.className = 'decade-btn';
    btn.textContent = decade === 0 ? '∞' : `${decade}`;
    btn.dataset.decade = decade;
    btn.title = decade === 0 ? 'Sem data' : `${decade}–${decade + 9}`;
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
    <p><strong>${selectedAlbum.artists}</strong></p>
    <p>${selectedAlbum.year} • ${selectedAlbum.tracks.length} canções</p>
  `;

  container.replaceChildren(cover, info);
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
    return;
  }

  tracksPanel.scrollTop = 0;
  const frag = document.createDocumentFragment();

  selectedAlbum.tracks.forEach((track, idx) => {
    const item = document.createElement('li');
    item.className = 'track-item';
    item.dataset.trackIdx = idx;
    if (currentTrack === track) item.classList.add('playing');

    const artistLabel = track.artists && track.artists !== selectedAlbum.artists
      ? `<div class="track-artist">${track.artists}</div>` : '';
    item.innerHTML = `
      <span class="track-num">${track.num}</span>
      <div class="track-details">
        <div class="track-title">${track.title}</div>
        ${artistLabel}
      </div>
      <span class="track-duration">-</span>
    `;
    frag.append(item);
  });

  container.replaceChildren(frag);
  renderedAlbum = selectedAlbum;
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

    const artistLabel = track.artists && track.artists !== album.artists
      ? `<div class="track-artist">${track.artists}</div>` : '';
    item.innerHTML = `
      <span class="track-num">${track.num}</span>
      <div class="track-details">
        <div class="track-title">${track.title}</div>
        ${artistLabel}
      </div>
      <span class="track-duration">-</span>
    `;
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
}

function playNext() {
  if (!selectedAlbum || !currentTrack) return;
  const tracks = selectedAlbum.tracks;
  if (shuffleOn) {
    const others = tracks.filter(t => t !== currentTrack);
    if (others.length) playTrack(others[Math.floor(Math.random() * others.length)]);
    return;
  }
  const idx = tracks.findIndex(t => t.num === currentTrack.num);
  if (idx < tracks.length - 1) playTrack(tracks[idx + 1]);
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
      currentTrack = album.tracks[0];
      updateNowPlaying();
      const audio = u('#audio').first();
      const newSrc = `${BASE_URL}/${currentTrack.file}`;
      if (audio.src !== newSrc) { audio.src = newSrc; audio.load(); }
    }

    updateMetaTags(album);
    window.history.pushState({ album: album.path }, '', generateAlbumUrl(album));
  });

  // Delegated click: desktop track list
  document.querySelector('#track-list').addEventListener('click', e => {
    const item = e.target.closest('[data-track-idx]');
    if (item && selectedAlbum) playTrack(selectedAlbum.tracks[parseInt(item.dataset.trackIdx)]);
  });

  // Delegated click: mobile drawer
  document.getElementById('drawer-track-list').addEventListener('click', e => {
    const item = e.target.closest('[data-track-idx]');
    if (item && selectedAlbum) {
      playTrack(selectedAlbum.tracks[parseInt(item.dataset.trackIdx)]);
      closeMobileDrawer();
    }
  });

  // Init virtual grid before data loads so it sizes correctly
  virtualGrid = new VirtualGrid(albumsList);

  // Async data: fetch gzipped JSON, decompress with pako
  const buf = await fetch('js/uqt-albums.json.gz').then(r => r.arrayBuffer());
  db = JSON.parse(pako.inflate(new Uint8Array(buf), { to: 'string' }));

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
    updateMetaTags(albumToSelect);
    window.history.replaceState({ album: albumToSelect.path }, '', generateAlbumUrl(albumToSelect));
  }

  const playerCover = u('#player-cover').first();
  if (playerCover && !playerCover.src) {
    playerCover.src = PLACEHOLDER_COVER;
    playerCover.classList.add('placeholder');
  }

  const audio = u('#audio').first();

  audio.addEventListener('play',  () => u('#btn-play').addClass('playing'));
  audio.addEventListener('pause', () => u('#btn-play').removeClass('playing'));

  const progressFill = document.querySelector('#progress-fill');
  audio.addEventListener('timeupdate', () => {
    const percent = (audio.currentTime / audio.duration) * 100 || 0;
    progressFill.style.width = percent + '%';
    u('#time-current').text(formatTime(audio.currentTime));
  });

  audio.addEventListener('loadedmetadata', () => {
    u('#time-duration').text(formatTime(audio.duration));
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
      audio.pause();
    }
  });

  u('#btn-prev').on('click', playPrevious);
  u('#btn-next').on('click', playNext);

  document.getElementById('drawer-close')?.addEventListener('click', closeMobileDrawer);
  document.getElementById('btn-tracklist')?.addEventListener('click', toggleMobileDrawer);

  const btnShuffle = document.getElementById('btn-shuffle');
  btnShuffle?.addEventListener('click', () => {
    shuffleOn = !shuffleOn;
    btnShuffle.classList.toggle('active', shuffleOn);
  });

  const btnRepeat = document.getElementById('btn-repeat');
  btnRepeat?.addEventListener('click', () => {
    repeatOn = !repeatOn;
    audio.loop = repeatOn;
    btnRepeat.classList.toggle('active', repeatOn);
  });

  const volumeSlider = document.getElementById('volume-slider');
  volumeSlider?.addEventListener('input', () => {
    audio.volume = parseFloat(volumeSlider.value);
    document.getElementById('volume-wave').style.display =
      parseFloat(volumeSlider.value) === 0 ? 'none' : '';
  });

  u('.progress-bar').on('click', function (e) {
    const rect = this.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
  });

  u('#search-input').on('input', function () {
    searchQuery = this.value;
    filterAlbums();
  });
});
