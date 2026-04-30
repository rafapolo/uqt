#!/usr/bin/env node
// Scan all MP3s under unzips/ and report files missing key ID3 tags.
// Output is suitable for drag-and-drop into MusicBrainz Picard.

const fs   = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const CONCURRENCY = 16;
const REQUIRED_TAGS = ['title', 'artist', 'album', 'year', 'track'];

function probeFile(filePath) {
  return new Promise((resolve) => {
    execFile('ffprobe', [
      '-v', 'quiet', '-print_format', 'json', '-show_format', filePath
    ], { encoding: 'buffer' }, (err, stdout) => {
      if (err) { resolve({ filePath, missing: ['(ffprobe error)'] }); return; }
      try {
        const probe = JSON.parse(stdout.toString('latin1'));
        const tags  = probe.format.tags || {};
        const missing = [];
        if (!tags.title)               missing.push('title');
        if (!tags.artist)              missing.push('artist');
        if (!tags.album)               missing.push('album');
        if (!tags.date && !tags.year)  missing.push('year');
        if (!tags.track)               missing.push('track');
        resolve(missing.length ? { filePath, missing } : null);
      } catch { resolve({ filePath, missing: ['(parse error)'] }); }
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
  let next = 0, done = 0;
  return new Promise((resolve) => {
    function runNext() {
      if (next >= items.length) return;
      const i = next++;
      fn(items[i]).then(r => {
        results[i] = r;
        done++;
        if (done === items.length) resolve(results);
        else runNext();
      });
    }
    for (let i = 0; i < Math.min(concurrency, items.length); i++) runNext();
  });
}

async function main() {
  const unzipsDir = path.join(__dirname, '..', 'unzips');
  if (!fs.existsSync(unzipsDir)) {
    console.error(`✗ Directory not found: ${unzipsDir}`);
    process.exit(1);
  }

  process.stderr.write('Scanning MP3 files...\n');
  const mp3Files = findMP3Files(unzipsDir);
  process.stderr.write(`Found ${mp3Files.length} files. Checking tags...\n`);

  let checked = 0;
  const results = await processInParallel(mp3Files, (filePath) => {
    return probeFile(filePath).then(r => {
      checked++;
      if (checked % 200 === 0) process.stderr.write(`  ${checked}/${mp3Files.length}\n`);
      return r;
    });
  }, CONCURRENCY);

  const untagged = results.filter(Boolean);
  for (const { filePath, missing } of untagged) {
    console.log(`${filePath}  missing: ${missing.join(', ')}`);
  }

  process.stderr.write(`\nSummary: ${untagged.length} / ${mp3Files.length} files missing tags\n`);
}

main();
