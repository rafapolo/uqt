#!/usr/bin/env node
/**
 * Generate album-centric JSON database from MP3 files
 * Reads MP3 metadata from unzips/ folder and outputs js/uqt-albums.js
 * Parallelized with up to 16 concurrent ffprobe calls
 */

const fs   = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const CONCURRENCY = 16;

// ID3 tags may be Latin-1 encoded; re-decode bytes as UTF-8 when valid, else keep Latin-1
function fixEncoding(str) {
  const asUtf8 = Buffer.from(str, 'latin1').toString('utf8');
  return asUtf8.includes('\ufffd') ? str : asUtf8;
}

function getMP3Metadata(filePath) {
  return new Promise((resolve) => {
    execFile('ffprobe', [
      '-v', 'quiet', '-print_format', 'json', '-show_format', filePath
    ], { encoding: 'buffer' }, (err, stdout) => {
      if (err) { resolve(null); return; }
      try {
        const probe = JSON.parse(stdout.toString('latin1'));
        const tags = probe.format.tags || {};
        resolve({
          title:    fixEncoding((tags.title  || path.basename(filePath, '.mp3')).trim()),
          artist:   fixEncoding((tags.artist || 'Unknown').trim()),
          album:    fixEncoding((tags.album  || 'Unknown').trim()),
          year:     parseInt(tags.date || tags.year || 0),
          tracknum: parseInt(tags.track?.split('/')[0] || 0),
          duration: Math.round(parseFloat(probe.format.duration) || 0)
        });
      } catch { resolve(null); }
    });
  });
}

function parseFolderMeta(folderName) {
  const parts = folderName.split(/ [–\-] /);
  const year  = /^\d{4}$/.test(parts[0]) ? parseInt(parts[0]) : 0;
  const artist = year
    ? (parts.length >= 3 ? parts[1].trim() : null)
    : (parts.length >= 2 ? parts[0].trim() : null);
  return { year, artist };
}

function findMP3Files(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) files = files.concat(findMP3Files(full));
    else if (item.endsWith('.mp3')) files.push(full);
  }
  return files;
}

async function processInParallel(items, fn, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  return new Promise((resolve) => {
    function runNext() {
      if (next >= items.length) return;
      const i = next++;
      fn(items[i], i).then(r => {
        results[i] = r;
        done++;
        if (done === items.length) resolve(results);
        else runNext();
      });
    }
    for (let i = 0; i < Math.min(concurrency, items.length); i++) runNext();
  });
}

async function generateAlbums() {
  const unzipsDir = path.join(__dirname, '..', 'unzips');

  if (!fs.existsSync(unzipsDir)) {
    console.error(`✗ Directory not found: ${unzipsDir}`);
    process.exit(1);
  }

  console.log('Finding MP3 files...');
  const mp3Files = findMP3Files(unzipsDir);
  console.log(`Found ${mp3Files.length} MP3 files — processing with ${CONCURRENCY} workers\n`);

  if (mp3Files.length === 0) { console.warn('No MP3 files found'); process.exit(0); }

  let processed = 0;
  const metas = await processInParallel(mp3Files, async (filePath, i) => {
    const meta = await getMP3Metadata(filePath);
    processed++;
    if (processed % 500 === 0) process.stdout.write(`\r  ${processed}/${mp3Files.length}`);
    return { filePath, meta };
  }, CONCURRENCY);
  console.log(`\r  ${mp3Files.length}/${mp3Files.length} ✓\n`);

  const albumsByPath = {};
  for (const { filePath, meta } of metas) {
    if (!meta) continue;
    const albumPath = path.dirname(filePath).split(path.sep).pop();
    if (!albumsByPath[albumPath]) {
      const albumDir  = path.dirname(filePath);
      const hasCover  = fs.existsSync(path.join(albumDir, 'capa.jpg'))
                     || fs.existsSync(path.join(albumDir, 'capa-min.jpg'));
      albumsByPath[albumPath] = {
        title: meta.album, year: meta.year,
        path: albumPath, has_cover: hasCover, tracks: []
      };
    }
    const fileName = path.basename(filePath);
    if (!albumsByPath[albumPath].tracks.some(t => t.file === fileName)) {
      albumsByPath[albumPath].tracks.push({
        title: meta.title, num: meta.tracknum,
        file: fileName, artists: meta.artist, duration: meta.duration
      });
    }
  }

  const albums = Object.values(albumsByPath)
    .filter(album => !album.path.startsWith('UQT'))
    .map(album => {
      album.tracks.sort((a, b) => a.num - b.num);
      const artists = [...new Set(album.tracks.map(t => t.artists))];
      album.artist = artists.length === 1 ? artists[0] : 'Various Artists';
      const fm = parseFolderMeta(album.path);
      if (!album.year && fm.year)             album.year   = fm.year;
      if (album.artist === 'Unknown' && fm.artist) album.artist = fm.artist;
      return album;
    })
    .sort((a, b) => b.year - a.year);

  const zlib      = require('zlib');
  const outputPath = path.join(__dirname, '..', 'js', 'uqt-albums.js');
  const gzPath     = path.join(__dirname, '..', 'js', 'uqt-albums.json.gz');
  const jsonStr    = JSON.stringify({ albums });

  fs.writeFileSync(outputPath, `db = ${JSON.stringify({ albums }, null, 2)}`);
  fs.writeFileSync(gzPath, zlib.gzipSync(Buffer.from(jsonStr)));

  const withCover = albums.filter(a => a.has_cover).length;
  console.log(`✓ ${albums.length} albums  (${withCover} with cover, ${albums.length - withCover} without)`);
  console.log(`✓ Tracks: ${albums.reduce((s, a) => s + a.tracks.length, 0)}`);
  console.log(`✓ ${outputPath}`);
  console.log(`✓ ${gzPath}  (${Math.round(fs.statSync(gzPath).size / 1024)} KB)`);
}

generateAlbums().catch(err => { console.error(err); process.exit(1); });
