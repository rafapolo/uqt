// State
let albums = [];
let filteredAlbums = [];
let selectedAlbum = null;
let currentTrack = null;
let allArtists = [];
let activeDecade = null;
let searchQuery = '';
let prevActiveItem = null;

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
// Deployed via haloy to xn--2dk.xyz
const BASE_URL = 'https://xn--2dk.xyz/uqt';
const PLACEHOLDER_COVER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Cdefs%3E%3ClinearGradient id="grad" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%232a2620;stop-opacity:1" /%3E%3Cstop offset="100%25" style="stop-color:%231a1814;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23grad)" width="200" height="200"/%3E%3Ccircle cx="100" cy="100" r="40" fill="none" stroke="%23d4a574" stroke-width="8"/%3E%3Ccircle cx="100" cy="100" r="15" fill="none" stroke="%23d4a574" stroke-width="2"/%3E%3Cpath d="M 100 60 Q 120 80 120 100 Q 120 125 100 140 Q 80 125 80 100 Q 80 80 100 60" fill="none" stroke="%23d4a574" stroke-width="3" stroke-linecap="round"/%3E%3C/svg%3E';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function loadCoverImage(imgElement, primaryUrl, fallbackUrl = '/capa.jpg') {
  // Show placeholder immediately to avoid blank space
  imgElement.src = PLACEHOLDER_COVER;
  imgElement.classList.remove('placeholder');

  // Pre-load the actual cover image
  const tempImg = new Image();
  tempImg.onload = () => {
    imgElement.src = primaryUrl;
  };
  tempImg.onerror = () => {
    // Primary failed, try fallback
    const fallbackImg = new Image();
    fallbackImg.onload = () => {
      imgElement.src = fallbackUrl;
    };
    fallbackImg.onerror = () => {
      // Fallback also failed, keep placeholder
      imgElement.src = PLACEHOLDER_COVER;
      imgElement.classList.add('placeholder');
    };
    fallbackImg.src = fallbackUrl;
  };
  tempImg.src = primaryUrl;
}

function buildAlbumsFromArtists() {
  albums = [];

  // Flatten artist albums into a single array
  db.artists.forEach(artist => {
    artist.albums.forEach(album => {
      albums.push({
        name: album.title,
        artists: artist.name,
        year: album.year,
        path: album.path,
        cover: `${BASE_URL}/${encodeURI(album.path)}/capa.jpg`,
        tracks: album.tracks.map(track => ({
          title: track.title,
          num: track.num,
          file: `${encodeURI(album.path)}/${encodeURI(track.file)}`,
          album: album.title,
          artists: track.artists || artist.name,
          year: album.year
        }))
      });
    });
  });

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
    const matchesSearch = searchQuery === '' ||
      album.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      album.artists.toLowerCase().includes(searchQuery.toLowerCase());

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
  const totalYears = new Set(filteredAlbums.map(a => a.year).filter(y => y > 0)).size;

  u('#stat-albums').text(`${totalAlbums} álbun${totalAlbums !== 1 ? 's' : ''}`);
  u('#stat-artists').text(`${totalArtists} artista${totalArtists !== 1 ? 's' : ''}`);
  u('#stat-years').text(`${totalYears} ano${totalYears !== 1 ? 's' : ''}`);
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
      if (selectedAlbum === album) return; // No change, skip re-render

      if (prevActiveItem) prevActiveItem.classList.remove('active');
      item.classList.add('active');
      prevActiveItem = item;

      selectedAlbum = album;
      renderAlbumHeader();
      renderTrackList();

      // Update URL when album is selected
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

  // Load cover with placeholder shown immediately
  loadCoverImage(cover, selectedAlbum.cover);

  const info = document.createElement('div');
  info.className = 'album-header-info';

  const shareUrl = generateAlbumUrl(selectedAlbum);
  info.innerHTML = `
    <h2>${selectedAlbum.name}</h2>
    <p><strong>${selectedAlbum.artists}</strong></p>
    <p>${selectedAlbum.year} • ${selectedAlbum.tracks.length} canções</p>
    <button id="btn-share-album" class="btn btn-share" title="Copiar link compartilhável">🔗 Compartilhar</button>
  `;

  container.innerHTML = '';
  container.append(cover, info);

  // Add share button event listener
  const shareBtn = container.querySelector('#btn-share-album');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(shareUrl).then(() => {
        const originalText = shareBtn.textContent;
        shareBtn.textContent = '✓ Link copiado!';
        setTimeout(() => {
          shareBtn.textContent = originalText;
        }, 2000);
      });
    });
  }
}

function renderTrackList() {
  const container = document.querySelector('#track-list');
  container.innerHTML = '';
  const tracksPanel = u('.tracks-panel').first();

  if (!selectedAlbum) {
    tracksPanel.classList.add('hidden');
    return;
  }

  tracksPanel.classList.remove('hidden');

  const list = document.createElement('ol');
  list.className = 'track-list';

  selectedAlbum.tracks.forEach(track => {
    const item = document.createElement('li');
    item.className = 'track-item';
    if (currentTrack === track) item.classList.add('playing');

    item.innerHTML = `
      <span class="track-num">${track.num}</span>
      <div class="track-details">
        <div class="track-title">${track.title}</div>
      </div>
      <span class="track-duration">-</span>
    `;

    item.addEventListener('click', () => {
      playTrack(track);
    });

    list.append(item);
  });

  container.append(list);
}

function playTrack(track) {
  currentTrack = track;
  updateNowPlaying();

  const audio = u('#audio').first();
  audio.src = `${BASE_URL}${encodeURI(track.file)}`;
  audio.play();

  u('#btn-play').addClass('playing');
  renderTrackList();
}

function updateNowPlaying() {
  if (!currentTrack) return;

  u('#player-title').text(currentTrack.title);
  u('#player-artist').text(currentTrack.artists);

  const folder = currentTrack.file.split('/')[1];
  const coverUrl = `${BASE_URL}/${folder}/capa.jpg`;
  const coverImg = u('#player-cover').first();

  if (!coverImg) return;

  // Load cover with placeholder shown immediately
  loadCoverImage(coverImg, coverUrl);
}

function playNext() {
  if (!selectedAlbum || !currentTrack) return;

  const currentIndex = selectedAlbum.tracks.findIndex(t => t.num === currentTrack.num);
  if (currentIndex < selectedAlbum.tracks.length - 1) {
    playTrack(selectedAlbum.tracks[currentIndex + 1]);
  }
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
  allArtists = db.artists;
  buildAlbumsFromArtists();
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

    // Update URL to reflect selected album
    const shareUrl = generateAlbumUrl(albumToSelect);
    window.history.replaceState({ album: albumToSelect.path }, '', shareUrl);
  }

  // Initialize player cover with default image
  const playerCover = u('#player-cover').first();
  if (playerCover && !playerCover.src) {
    playerCover.src = '/capa.jpg';
    playerCover.onerror = function() {
      if (this.src !== PLACEHOLDER_COVER) {
        this.src = PLACEHOLDER_COVER;
        this.classList.add('placeholder');
        this.onerror = null;
      }
    };
  }

  // Audio element
  const audio = u('#audio').first();

  audio.addEventListener('play', () => {
    u('#btn-play').addClass('playing');
  });

  audio.addEventListener('pause', () => {
    u('#btn-play').removeClass('playing');
  });

  audio.addEventListener('timeupdate', () => {
    const percent = (audio.currentTime / audio.duration) * 100 || 0;
    u('#progress-fill').css('width', percent + '%');
    u('#time-current').text(formatTime(audio.currentTime));
  });

  audio.addEventListener('loadedmetadata', () => {
    u('#time-duration').text(formatTime(audio.duration));
  });

  audio.addEventListener('ended', () => {
    playNext();
  });

  // Control buttons
  u('#btn-play').on('click', function () {
    if (audio.paused) {
      if (!currentTrack && filteredAlbums.length > 0) {
        selectedAlbum = filteredAlbums[0];
        renderAlbumsList();
        renderAlbumHeader();
        renderTrackList();
        playTrack(selectedAlbum.tracks[0]);
      } else {
        audio.play();
      }
    } else {
      audio.pause();
    }
  });

  u('#btn-prev').on('click', playPrevious);
  u('#btn-next').on('click', playNext);

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
