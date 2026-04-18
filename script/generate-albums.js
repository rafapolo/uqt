#!/usr/bin/env node
/**
 * Generate album-centric JSON database from MP3 files
 * Reads MP3 metadata from unzips/ folder and outputs js/uqt-albums.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Helper to extract metadata using ffprobe (must be installed)
function getMP3Metadata(filePath) {
  try {
    const cmd = `ffprobe -v quiet -print_format json -show_format "${filePath}"`;
    const result = execSync(cmd, { encoding: 'utf-8' });
    const probe = JSON.parse(result);
    const tags = probe.format.tags || {};

    return {
      title: (tags.title || path.basename(filePath, '.mp3')).trim(),
      artist: (tags.artist || 'Unknown').trim(),
      album: (tags.album || 'Unknown').trim(),
      year: parseInt(tags.date || tags.year || 0),
      tracknum: parseInt(tags.track?.split('/')[0] || 0),
      duration: Math.round(parseFloat(probe.format.duration) || 0)
    };
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

// Recursively find all MP3 files
function findMP3Files(dir) {
  let files = [];
  const items = fs.readdirSync(dir);

  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files = files.concat(findMP3Files(fullPath));
    } else if (item.endsWith('.mp3')) {
      files.push(fullPath);
    }
  });

  return files;
}

// Main generator
function generateAlbums() {
  const unzipsDir = path.join(__dirname, '..', 'unzips');

  if (!fs.existsSync(unzipsDir)) {
    console.error(`✗ Directory not found: ${unzipsDir}`);
    process.exit(1);
  }

  console.log('Finding MP3 files...');
  const mp3Files = findMP3Files(unzipsDir);
  console.log(`Found ${mp3Files.length} MP3 files\n`);

  if (mp3Files.length === 0) {
    console.warn('No MP3 files found');
    process.exit(0);
  }

  // Group by album path
  const albumsByPath = {};

  mp3Files.forEach((filePath, index) => {
    if ((index + 1) % 100 === 0) {
      console.log(`Processing: ${index + 1}/${mp3Files.length}`);
    }

    const meta = getMP3Metadata(filePath);
    if (!meta) return;

    // Extract album folder (last part of path before filename)
    const albumPath = path.dirname(filePath).split(path.sep).pop();

    // Initialize album entry
    if (!albumsByPath[albumPath]) {
      albumsByPath[albumPath] = {
        title: meta.album,
        year: meta.year,
        path: albumPath,
        tracks: []
      };
    }

    // Add track, deduplicate by filename
    const fileName = path.basename(filePath);
    if (!albumsByPath[albumPath].tracks.some(t => t.file === fileName)) {
      albumsByPath[albumPath].tracks.push({
        title: meta.title,
        num: meta.tracknum,
        file: fileName,
        artists: meta.artist,
        duration: meta.duration
      });
    }
  });

  // Process albums: sort tracks, determine artist
  const albums = Object.values(albumsByPath)
    .map(album => {
      // Sort tracks by track number
      album.tracks.sort((a, b) => a.num - b.num);

      // Determine artist: single if all match, else "Various Artists"
      const artists = [...new Set(album.tracks.map(t => t.artists))];
      album.artist = artists.length === 1 ? artists[0] : 'Various Artists';

      return album;
    })
    .sort((a, b) => b.year - a.year); // Sort by year descending

  // Write output
  const zlib = require('zlib');
  const outputPath = path.join(__dirname, '..', 'js', 'uqt-albums.js');
  const gzPath    = path.join(__dirname, '..', 'js', 'uqt-albums.json.gz');
  const jsonStr   = JSON.stringify({ albums });
  const output    = `db = ${JSON.stringify({ albums }, null, 2)}`;

  fs.writeFileSync(outputPath, output);
  fs.writeFileSync(gzPath, zlib.gzipSync(Buffer.from(jsonStr)));

  console.log(`\n✓ Generated ${albums.length} albums`);
  console.log(`✓ Total tracks: ${albums.reduce((sum, a) => sum + a.tracks.length, 0)}`);
  console.log(`✓ Written to: ${outputPath}`);
  console.log(`✓ Gzipped to: ${gzPath} (${Math.round(fs.statSync(gzPath).size / 1024)} KB)`);
}

// Run
generateAlbums();
