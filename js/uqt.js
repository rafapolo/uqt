// State
let albums = [];
let filteredAlbums = [];
let selectedAlbum = null;
let currentTrack = null;
let activeDecade = null;
let searchQuery = '';
let prevActiveItem = null;
let shuffleOn = false;
let repeatOn = false;

// Get album ID from URL params
function getAlbumFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('album');
}

// Generate shareable URL for an album
function generateAlbumUrl(album) {
  const params = new URLSearchParams();
  params.set('album', album.path);
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

// Base URL for audio streaming via proxy (zero-egress, no surprise charges)
// The proxy forwards to Hetzner bucket, both in HEL1 zone = free transfer
// Deployed via haloy to haloy.xn--2dk.xyz
const BASE_URL = 'https://uqt.xn--2dk.xyz/uqt';
const PLACEHOLDER_COVER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Cdefs%3E%3ClinearGradient id="grad" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%232a2620;stop-opacity:1" /%3E%3Cstop offset="100%25" style="stop-color:%231a1814;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23grad)" width="200" height="200"/%3E%3Ccircle cx="100" cy="100" r="40" fill="none" stroke="%23d4a574" stroke-width="8"/%3E%3Ccircle cx="100" cy="100" r="15" fill="none" stroke="%23d4a574" stroke-width="2"/%3E%3Cpath d="M 100 60 Q 120 80 120 100 Q 120 125 100 140 Q 80 125 80 100 Q 80 80 100 60" fill="none" stroke="%23d4a574" stroke-width="3" stroke-linecap="round"/%3E%3C/svg%3E';

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

  // Sort albums by year descending
  albums.sort((a, b) => b.year - a.year);
  return albums;
}

function getDecades() {
  const years = new Set(albums.map(a => a.year));
  const decades = new Set();
  years.forEach(year => {
    const decade = Math.floor(year / 10) * 10;
    decades.add(decade);
  });
  return Array.from(decades).sort((a, b) => a - b);
}

function renderDecadeButtons() {
  const decades = getDecades();
  const container = document.querySelector('#decade-buttons');
  container.innerHTML = ''; // Clear existing buttons

  // Add "Todos" (All) button
  const todosBtn = document.createElement('button');
  todosBtn.className = 'decade-btn active';
  todosBtn.textContent = 'Todos';
  todosBtn.dataset.decade = 'all';

  todosBtn.addEventListener('click', () => {
    activeDecade = null;
    searchQuery = '';
    u('#search-input').first().value = '';
    filterAlbums();

    // Update all button states
    const allBtns = container.querySelectorAll('.decade-btn');
    allBtns.forEach(b => b.classList.remove('active'));
    todosBtn.classList.add('active');
  });

  container.append(todosBtn);

  // Add decade buttons
  decades.forEach(decade => {
    const btn = document.createElement('button');
    btn.className = 'decade-btn';
    btn.textContent = `${decade}`;
    btn.dataset.decade = decade;
    btn.title = `${decade}–${decade + 9}`;

    btn.addEventListener('click', () => {
      const decadeNum = parseInt(btn.dataset.decade);
      activeDecade = decadeNum;
      searchQuery = '';
      u('#search-input').first().value = '';
      filterAlbums();

      // Update button states
      const allBtns = container.querySelectorAll('.decade-btn');
      allBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });

    container.append(btn);
  });
}

function filterAlbums() {
  filteredAlbums = albums.filter(album => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchQuery === '' ||
      (album.name && album.name.toLowerCase().includes(searchLower)) ||
      (album.artists && album.artists.toLowerCase().includes(searchLower)) ||
      (album.path && album.path.toLowerCase().includes(searchLower)) ||
      album.tracks.some(track => track.artists && track.artists.toLowerCase().includes(searchLower));

    const matchesDecade = activeDecade === null ||
      Math.floor(album.year / 10) * 10 === activeDecade;

    return matchesSearch && matchesDecade;
  });

  renderAlbumsList();
  updateLibraryStats();
}

function updateLibraryStats() {
  const totalAlbums = filteredAlbums.length;
  const totalArtists = new Set(filteredAlbums.map(a => a.artists).filter(a => a && a.length > 0)).size;

  const albumsText = `${totalAlbums} álbun${totalAlbums !== 1 ? 's' : ''}`;
  const artistsText = `${totalArtists} artista${totalArtists !== 1 ? 's' : ''}`;

  u('#mobile-stat-albums').text(albumsText);
  u('#mobile-stat-artists').text(artistsText);
}

function renderAlbumsList() {
  const container = document.querySelector('#albums-list');
  container.innerHTML = '';
  prevActiveItem = null; // Reset tracking on re-render

  filteredAlbums.forEach(album => {
    const item = document.createElement('div');
    item.className = 'album-item';
    if (selectedAlbum === album) {
      item.classList.add('active');
      prevActiveItem = item;
    }

    const cover = document.createElement('img');
    cover.className = 'album-cover-thumb';
    cover.alt = album.name;
    cover.loading = 'lazy';

    // Load cover with placeholder shown immediately
    loadCoverImage(cover, album.cover);

    const info = document.createElement('div');
    info.className = 'album-item-info';

    const title = document.createElement('div');
    title.className = 'album-item-title';
    title.textContent = album.name;

    const meta = document.createElement('div');
    meta.className = 'album-item-meta';
    meta.textContent = `${album.artists} • ${album.year}`;

    info.append(title, meta);
    item.append(cover, info);

    item.addEventListener('click', () => {
      if (selectedAlbum === album) return;

      if (prevActiveItem) prevActiveItem.classList.remove('active');
      item.classList.add('active');
      prevActiveItem = item;

      selectedAlbum = album;
      renderAlbumHeader();
      renderTrackList();
      renderMobileDrawer(album);
      if (isMobile()) openMobileDrawer();

      if (album.tracks.length > 0) {
        const track = album.tracks[0];
        currentTrack = track;
        updateNowPlaying();
        const audio = u('#audio').first();
        const newSrc = `${BASE_URL}/${track.file}`;
        if (audio.src !== newSrc) {
          audio.src = newSrc;
          audio.load();
        }
      }

      const shareUrl = generateAlbumUrl(album);
      window.history.pushState({ album: album.path }, '', shareUrl);
    });

    container.append(item);
  });
}

function renderAlbumHeader() {
  const container = u('#album-header').first();

  if (!selectedAlbum) {
    container.innerHTML = '';
    return;
  }

  const cover = document.createElement('img');
  cover.className = 'album-cover-large';
  cover.alt = selectedAlbum.name;
  cover.loading = 'lazy';

  // Load cover with placeholder shown immediately
  loadCoverImage(cover, selectedAlbum.cover);

  const info = document.createElement('div');
  info.className = 'album-header-info';

  const shareUrl = generateAlbumUrl(selectedAlbum);
  info.innerHTML = `
    <h2>${selectedAlbum.name}</h2>
    <p><strong>${selectedAlbum.artists}</strong></p>
    <p>${selectedAlbum.year} • ${selectedAlbum.tracks.length} canções</p>
  `;

  container.innerHTML = '';
  container.append(cover, info);
}

function renderTrackList() {
  const container = document.querySelector('#track-list');
  container.innerHTML = '';
  const tracksPanel = u('.tracks-panel').first();
  tracksPanel.scrollTop = 0;

  if (!selectedAlbum) {
    tracksPanel.classList.add('hidden');
    return;
  }

  tracksPanel.classList.remove('hidden');

  selectedAlbum.tracks.forEach(track => {
    const item = document.createElement('li');
    item.className = 'track-item';
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

    item.addEventListener('click', () => {
      playTrack(track);
    });

    container.append(item);
  });
}

function isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function openMobileDrawer()   { document.getElementById('mobile-track-drawer')?.classList.add('open'); }
function closeMobileDrawer()  { document.getElementById('mobile-track-drawer')?.classList.remove('open'); }
function toggleMobileDrawer() { document.getElementById('mobile-track-drawer')?.classList.toggle('open'); }

function renderMobileDrawer(album) {
  const titleEl = document.getElementById('drawer-album-title');
  const metaEl = document.getElementById('drawer-album-meta');
  const coverEl = document.getElementById('drawer-cover');
  const listEl = document.getElementById('drawer-track-list');

  if (!album) {
    if (titleEl) titleEl.textContent = '';
    if (metaEl) metaEl.textContent = '';
    if (listEl) listEl.innerHTML = '';
    return;
  }

  if (titleEl) titleEl.textContent = album.name;
  if (metaEl) metaEl.textContent = `${album.artists} · ${album.year} · ${album.tracks.length} faixas`;
  if (coverEl) loadCoverImage(coverEl, album.cover);

  if (!listEl) return;
  listEl.innerHTML = '';

  album.tracks.forEach(track => {
    const item = document.createElement('li');
    item.className = 'track-item';
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

    item.addEventListener('click', () => {
      playTrack(track);
      closeMobileDrawer();
    });

    listEl.append(item);
  });
}

function syncDrawerPlayingState() {
  const listEl = document.getElementById('drawer-track-list');
  if (!listEl || !selectedAlbum) return;

  const items = listEl.querySelectorAll('.track-item');
  selectedAlbum.tracks.forEach((track, index) => {
    const item = items[index];
    if (!item) return;
    if (currentTrack === track) {
      item.classList.add('playing');
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      item.classList.remove('playing');
    }
  });
}

function safePlay(audio) {
  const p = audio.play();
  if (p && typeof p.catch === 'function') {
    p.catch(err => {
      if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
        console.error('audio.play() failed:', err);
      }
    });
  }
}

function playTrack(track) {
  currentTrack = track;
  updateNowPlaying();

  const audio = u('#audio').first();
  const newSrc = `${BASE_URL}/${track.file}`;
  if (audio.src !== newSrc) {
    audio.src = newSrc;
    audio.load();
  }
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

  if (!coverImg) return;

  coverImg.loading = 'lazy';

  // Load cover with placeholder shown immediately
  loadCoverImage(coverImg, coverUrl);

  const drawerCover = document.getElementById('drawer-cover');
  if (drawerCover) loadCoverImage(drawerCover, coverUrl);
}

function playNext() {
  if (!selectedAlbum || !currentTrack) return;

  const tracks = selectedAlbum.tracks;
  if (shuffleOn) {
    const others = tracks.filter(t => t !== currentTrack);
    if (others.length > 0) playTrack(others[Math.floor(Math.random() * others.length)]);
    return;
  }
  const currentIndex = tracks.findIndex(t => t.num === currentTrack.num);
  if (currentIndex < tracks.length - 1) playTrack(tracks[currentIndex + 1]);
}

function playPrevious() {
  if (!selectedAlbum || !currentTrack) return;

  const currentIndex = selectedAlbum.tracks.findIndex(t => t.num === currentTrack.num);
  if (currentIndex > 0) {
    playTrack(selectedAlbum.tracks[currentIndex - 1]);
  }
}

u(document).on('DOMContentLoaded', function () {
  // Load and process data
  buildAlbums();
  filteredAlbums = [...albums];

  // Initialize UI
  renderDecadeButtons();
  renderAlbumsList();
  updateLibraryStats();

  // Try to load album from URL params, otherwise select first album
  const albumFromUrl = getAlbumFromUrl();
  let albumToSelect = null;

  if (albumFromUrl) {
    // Find album by path
    albumToSelect = albums.find(a => a.path === albumFromUrl);
  }

  if (!albumToSelect && filteredAlbums.length > 0) {
    albumToSelect = filteredAlbums[0];
  }

  if (albumToSelect) {
    selectedAlbum = albumToSelect;
    renderAlbumsList(); // Re-render to highlight selected album
    renderAlbumHeader();
    renderTrackList();
    renderMobileDrawer(albumToSelect);

    // Update URL to reflect selected album
    const shareUrl = generateAlbumUrl(albumToSelect);
    window.history.replaceState({ album: albumToSelect.path }, '', shareUrl);
  }

  const playerCover = u('#player-cover').first();
  if (playerCover && !playerCover.src) {
    playerCover.src = PLACEHOLDER_COVER;
    playerCover.classList.add('placeholder');
  }

  // Audio element
  const audio = u('#audio').first();

  audio.addEventListener('play', () => {
    u('#btn-play').addClass('playing');
  });

  audio.addEventListener('pause', () => {
    u('#btn-play').removeClass('playing');
  });

  const progressFill = document.querySelector('#progress-fill');
  audio.addEventListener('timeupdate', () => {
    const percent = (audio.currentTime / audio.duration) * 100 || 0;
    progressFill.style.width = percent + '%';
    u('#time-current').text(formatTime(audio.currentTime));
  });

  audio.addEventListener('loadedmetadata', () => {
    u('#time-duration').text(formatTime(audio.duration));
  });

  audio.addEventListener('ended', () => {
    playNext();
  });

  u('#btn-play').on('click', function () {
    if (audio.paused) {
      if (!currentTrack) {
        if (selectedAlbum && selectedAlbum.tracks.length > 0) {
          playTrack(selectedAlbum.tracks[0]);
        } else if (filteredAlbums.length > 0) {
          selectedAlbum = filteredAlbums[0];
          renderAlbumsList();
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

  // Progress bar click
  u('.progress-bar').on('click', function (e) {
    const rect = this.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
  });

  // Search input
  u('#search-input').on('input', function () {
    searchQuery = this.value;
    filterAlbums();
  });
});
