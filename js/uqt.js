// State
let albums = [];
let filteredAlbums = [];
let selectedAlbum = null;
let currentTrack = null;
let allTracks = [];
let activeDecade = null;
let searchQuery = '';

const BASE_URL = 'https://subzku.net/uqt';
const PLACEHOLDER_COVER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Crect fill="%232a2620" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="60" fill="%237a7268" font-family="serif"%3E♫%3C/text%3E%3C/svg%3E';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function groupTracksByAlbum() {
  const albumMap = {};

  allTracks.forEach(track => {
    const folder = track.file.split('/')[1];
    const albumKey = track.album;

    if (!albumMap[albumKey]) {
      albumMap[albumKey] = {
        name: track.album,
        artists: track.artists,
        year: track.year,
        cover: `${BASE_URL}/${folder}/cover.jpg`,
        tracks: []
      };
    }

    albumMap[albumKey].tracks.push(track);
  });

  // Sort tracks within each album by number, then sort albums by year descending
  Object.values(albumMap).forEach(album => {
    album.tracks.sort((a, b) => a.num - b.num);
  });

  albums = Object.values(albumMap).sort((a, b) => b.year - a.year);
  return albums;
}

function getDecades() {
  const years = new Set(allTracks.map(t => t.year));
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

  decades.forEach(decade => {
    const btn = document.createElement('button');
    btn.className = 'decade-btn';
    btn.textContent = `${decade}s`;
    btn.dataset.decade = decade;
    btn.addEventListener('click', () => {
      const allBtns = container.querySelectorAll('.decade-btn');
      allBtns.forEach(b => {
        if (b.dataset.decade === btn.dataset.decade) {
          activeDecade = activeDecade === decade ? null : decade;
          b.classList.toggle('active');
        } else {
          b.classList.remove('active');
        }
      });
      filterAlbums();
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
    cover.src = album.cover;
    cover.onerror = () => { cover.src = PLACEHOLDER_COVER; };
    cover.alt = album.name;

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
  const container = u('#album-header');

  if (!selectedAlbum) {
    container.html('');
    return;
  }

  container.html(`
    <img class="album-cover-large" src="${selectedAlbum.cover}" alt="${selectedAlbum.name}" onerror="this.src='${PLACEHOLDER_COVER}'">
    <div class="album-header-info">
      <h2>${selectedAlbum.name}</h2>
      <p><strong>${selectedAlbum.artists}</strong></p>
      <p>${selectedAlbum.year} • ${selectedAlbum.tracks.length} canções</p>
    </div>
  `);
}

function renderTrackList() {
  const container = u('#track-list');
  container.html('');

  if (!selectedAlbum) return;

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
  const coverUrl = `${BASE_URL}/${folder}/cover.jpg`;
  const coverImg = u('#player-cover').first();
  coverImg.src = coverUrl;
  coverImg.onerror = () => { coverImg.src = PLACEHOLDER_COVER; };
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
  allTracks = db.tracks;
  groupTracksByAlbum();
  filteredAlbums = [...albums];

  // Initialize UI
  renderDecadeButtons();
  renderAlbumsList();

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
