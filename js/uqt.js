// Player State
let currentTrack = null;
let filteredTracks = [];
let gridInstance = null;

// Helper function to format time
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Update now playing display
function updateNowPlaying(track) {
  u('#np-title').text(track.title);
  u('#np-artist').text(track.artists);
  u('#np-album').text(track.album + ' (' + track.year + ')');
  u('#np-placeholder').html('▶');
}

// Play track
function play(album, title) {
  const track = db.tracks.find(t => t.album === album && t.title === title);
  if (!track) return;

  currentTrack = track;
  updateNowPlaying(track);

  const audio = u('#audio').first();
  audio.src = 'https://subzku.net/uqt' + encodeURI(track.file);
  audio.play();

  u('#btn-play').addClass('playing');
}

// Play previous track
function playPrevious() {
  if (!currentTrack) return;

  const currentIndex = filteredTracks.findIndex(
    t => t.album === currentTrack.album && t.title === currentTrack.title
  );

  if (currentIndex > 0) {
    const prevTrack = filteredTracks[currentIndex - 1];
    play(prevTrack.album, prevTrack.title);
  }
}

// Play next track
function playNext() {
  if (!currentTrack) return;

  const currentIndex = filteredTracks.findIndex(
    t => t.album === currentTrack.album && t.title === currentTrack.title
  );

  if (currentIndex < filteredTracks.length - 1) {
    const nextTrack = filteredTracks[currentIndex + 1];
    play(nextTrack.album, nextTrack.title);
  }
}

// Initialize Grid.js table with current filter
function initializeGrid(tracks) {
  const container = document.getElementById('player');

  if (gridInstance) {
    gridInstance.destroy();
  }

  gridInstance = new gridjs.Grid({
    language: {
      search: {
        placeholder: 'Busca...'
      },
      pagination: {
        previous: '◀',
        next: '▶',
        showing: 'Mostrando',
        results: () => 'canções'
      }
    },
    columns: [
      {
        id: 'title',
        name: 'Título',
        formatter: (_, row) =>
          gridjs.html(
            `<a class='play' href='#' onclick='play("${row.cells[2].data.replace(/"/g, '\\"')}", "${row.cells[0].data.replace(/"/g, '\\"')}'>${row.cells[0].data}</a>`
          )
      },
      {
        id: 'artists',
        name: 'Artista'
      },
      {
        id: 'album',
        name: 'Álbum'
      },
      {
        id: 'year',
        name: 'Ano'
      }
    ],
    pagination: {
      limit: 50
    },
    sort: true,
    data: tracks,
    search: {
      enabled: false // We'll handle search manually
    }
  }).render(container);
}

// Handle search
function handleSearch(query) {
  const q = query.toLowerCase();
  filteredTracks = db.tracks.filter(track =>
    track.title.toLowerCase().includes(q) ||
    track.artists.toLowerCase().includes(q) ||
    track.album.toLowerCase().includes(q) ||
    track.year.toString().includes(q)
  );
  initializeGrid(filteredTracks);
}

// Initialize app
u(document).on('DOMContentLoaded', function () {
  // Start with all tracks
  filteredTracks = [...db.tracks];

  // Shuffle tracks (random order)
  filteredTracks.sort(() => 0.5 - Math.random());

  // Initialize grid
  initializeGrid(filteredTracks);

  const audio = u('#audio').first();

  // Audio event listeners
  u('#audio').on('loadstart', function () {
    u('#btn-play').addClass('playing');
  });

  u('#audio').on('canplay', function () {
    u('#btn-play').addClass('playing');
  });

  u('#audio').on('play', function () {
    u('#btn-play').addClass('playing');
  });

  u('#audio').on('pause', function () {
    u('#btn-play').removeClass('playing');
  });

  u('#audio').on('timeupdate', function () {
    const currentTime = audio.currentTime;
    const duration = audio.duration;
    const percent = (currentTime / duration) * 100 || 0;
    u('#progress-fill').css('width', percent + '%');
    u('#time-current').text(formatTime(currentTime));
    u('#time-duration').text(formatTime(duration));
  });

  u('#audio').on('loadedmetadata', function () {
    u('#time-duration').text(formatTime(audio.duration));
  });

  u('#audio').on('ended', function () {
    playNext();
  });

  // Progress bar click handling
  u('.progress-bar').on('click', function (e) {
    const rect = this.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
  });

  // Control buttons
  u('#btn-play').on('click', function () {
    if (audio.paused) {
      if (!currentTrack && filteredTracks.length > 0) {
        play(filteredTracks[0].album, filteredTracks[0].title);
      } else {
        audio.play();
      }
    } else {
      audio.pause();
    }
  });

  u('#btn-prev').on('click', playPrevious);
  u('#btn-next').on('click', playNext);

  // Search functionality
  u('#search-input').on('input', function () {
    handleSearch(this.value);
  });
});
