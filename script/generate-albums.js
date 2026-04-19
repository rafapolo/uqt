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

function getMP3Metadata(filePath) {
  return new Promise((resolve) => {
    execFile('ffprobe', [
      '-v', 'quiet', '-print_format', 'json', '-show_format', filePath
    ], { encoding: 'utf-8' }, (err, stdout) => {
      if (err) { resolve(null); return; }
      try {
        const probe = JSON.parse(stdout);
        const tags = probe.format.tags || {};
        resolve({
          title:    (tags.title  || path.basename(filePath, '.mp3')).trim(),
          artist:   (tags.artist || 'Unknown').trim(),
          album:    (tags.album  || 'Unknown').trim(),
          year:     parseInt(tags.date || tags.year || 0),
          tracknum: parseInt(tags.track?.split('/')[0] || 0),
          duration: Math.round(parseFloat(probe.format.duration) || 0)
        });
      } catch { resolve(null); }
    });
  });
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
    .map(album => {
      album.tracks.sort((a, b) => a.num - b.num);
      const artists = [...new Set(album.tracks.map(t => t.artists))];
      album.artist = artists.length === 1 ? artists[0] : 'Various Artists';
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
