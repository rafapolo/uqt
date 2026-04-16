// State
let albums = [];
let filteredAlbums = [];
let selectedAlbum = null;
let currentTrack = null;
let allArtists = [];
let activeDecade = null;
let searchQuery = '';

// Base URL for audio streaming via proxy (zero-egress, no surprise charges)
// The proxy forwards to Hetzner bucket, both in HEL1 zone = free transfer
// Server IP: 89.167.95.136 (proxy runs here, not on GitHub Pages)
const BASE_URL = 'http://89.167.95.136:9001/uqt';
const PLACEHOLDER_COVER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Cdefs%3E%3ClinearGradient id="grad" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%232a2620;stop-opacity:1" /%3E%3Cstop offset="100%25" style="stop-color:%231a1814;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23grad)" width="200" height="200"/%3E%3Ccircle cx="100" cy="100" r="40" fill="none" stroke="%23d4a574" stroke-width="8"/%3E%3Ccircle cx="100" cy="100" r="15" fill="none" stroke="%23d4a574" stroke-width="2"/%3E%3Cpath d="M 100 60 Q 120 80 120 100 Q 120 125 100 140 Q 80 125 80 100 Q 80 80 100 60" fill="none" stroke="%23d4a574" stroke-width="3" stroke-linecap="round"/%3E%3C/svg%3E';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        cover: `${BASE_URL}/${album.path}/capa.jpg`,
        tracks: album.tracks.map(track => ({
          title: track.title,
          num: track.num,
          file: `${album.path}/${track.file}`,
          album: album.title,
          artists: artist.name,
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
  const container = u('#decade-buttons');
  container.html(''); // Clear existing buttons

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
  const container = u('#albums-list');
  container.html('');

  filteredAlbums.forEach(album => {
    const item = document.createElement('div');
    item.className = 'album-item';
    if (selectedAlbum === album) item.classList.add('active');

    const cover = document.createElement('img');
    cover.className = 'album-cover-thumb';
    cover.alt = album.name;

    // Set up fallback chain: proxy -> default -> placeholder
    let attemptCount = 0;
    cover.onerror = function() {
      attemptCount++;
      if (attemptCount === 1 && this.src.includes(BASE_URL)) {
        // Proxy failed (CORB or 404), try default cover
        this.src = '/capa.jpg';
      } else if (attemptCount === 2 || this.src === '/capa.jpg') {
        // Default also failed, use placeholder
        this.src = PLACEHOLDER_COVER;
        this.classList.add('placeholder');
        this.onerror = null;
      }
    };

    // Try proxy first
    cover.src = album.cover;

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
      selectedAlbum = album;
      renderAlbumsList();
      renderTrackList();
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

  // Set up fallback chain: proxy -> default -> placeholder
  let attemptCount = 0;
  cover.onerror = function() {
    attemptCount++;
    if (attemptCount === 1 && this.src.includes(BASE_URL)) {
      // Proxy failed (CORB or 404), try default cover
      this.src = '/capa.jpg';
    } else if (attemptCount === 2 || this.src === '/capa.jpg') {
      // Default also failed, use placeholder
      this.src = PLACEHOLDER_COVER;
      this.classList.add('placeholder');
      this.onerror = null;
    }
  };

  // Try proxy first
  cover.src = selectedAlbum.cover;

  const info = document.createElement('div');
  info.className = 'album-header-info';
  info.innerHTML = `
    <h2>${selectedAlbum.name}</h2>
    <p><strong>${selectedAlbum.artists}</strong></p>
    <p>${selectedAlbum.year} • ${selectedAlbum.tracks.length} canções</p>
  `;

  container.innerHTML = '';
  container.append(cover, info);
}

function renderTrackList() {
  const container = u('#track-list');
  container.html('');
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

  coverImg.classList.remove('placeholder');

  // Set up fallback chain: proxy -> default -> placeholder
  let attemptCount = 0;
  coverImg.onerror = function() {
    attemptCount++;
    if (attemptCount === 1 && this.src.includes(BASE_URL)) {
      // Proxy failed (CORB or 404), try default cover
      this.src = '/capa.jpg';
    } else if (attemptCount === 2 || this.src === '/capa.jpg') {
      // Default also failed, use placeholder
      this.src = PLACEHOLDER_COVER;
      this.classList.add('placeholder');
      this.onerror = null;
    }
  };

  // Try proxy first
  coverImg.src = coverUrl;
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

  // Select first album by default
  if (filteredAlbums.length > 0) {
    selectedAlbum = filteredAlbums[0];
    renderAlbumsList(); // Re-render to highlight selected album
    renderAlbumHeader();
    renderTrackList();
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
