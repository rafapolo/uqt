#!/usr/bin/env node
/**
 * Create resized covers locally and upload via mc mirror (new files only)
 * Usage: node js/resize-cover-images.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');

const S3_BUCKET = 'sambaraiz';
const S3_REGION = 'hel1';
const TARGET_WIDTH = 200;
const SOURCE_DIR = '/Volumes/EXTRA/bkps/sambaderaiz';
const TEMP_DIR = path.join(require('os').tmpdir(), 'uqt-covers-resize');
const MC_ALIAS = 'hel1';

function loadEnv(file = '.env') {
  const envPath = path.resolve(__dirname, '..', file);
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*([\w]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m) process.env[m[1]] = m[2];
    }
  }
}
loadEnv();

function setupMc() {
  try {
    execSync(`mc alias ls ${MC_ALIAS}/${S3_BUCKET} 2>/dev/null`, { stdio: 'pipe' });
  } catch {
    const ak = process.env.AWS_ACCESS_KEY_ID;
    const sk = process.env.AWS_SECRET_ACCESS_KEY;
    execSync(`mc alias set ${MC_ALIAS} https://${S3_REGION}.your-objectstorage.com "${ak}" "${sk}"`, { stdio: 'pipe' });
  }
}
setupMc();

function findJpgFiles(dir) {
  const covers = [];
  if (!fs.existsSync(dir)) return covers;

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const subCovers = findJpgFiles(fullPath);
      covers.push(...subCovers);
    } else {
      const ext = path.extname(item).toLowerCase();
      if (ext === '.jpg' || ext === '.jpeg') {
        covers.push({ path: fullPath, size: stat.size });
      }
    }
  }
  return covers;
}

function findBestCover(albumDir) {
  const files = findJpgFiles(albumDir);
  if (files.length === 0) return null;
  files.sort((a, b) => b.size - a.size);
  return files[0].path;
}

function normalizeAlbumPath(folderName) {
  return folderName.replace(/_/g, ' ');
}

async function resizeAndSave(coverPath, albumPath) {
  const buffer = await sharp(coverPath)
    .resize(TARGET_WIDTH, null, { withoutEnlargement: true, fit: 'inside' })
    .jpeg({ quality: 80 })
    .toBuffer();

  const destPath = path.join(TEMP_DIR, albumPath, 'capa-min.jpg');
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buffer);
  return buffer.length;
}

async function main() {
  console.log('Loading album database...');
  const dbPath = path.resolve(__dirname, '..', 'js', 'uqt-albums.js');
  const content = fs.readFileSync(dbPath, 'utf8');
  const db = eval('(' + content.replace(/^db\s*=\s*/, '') + ')');
  const albums = db.albums;
  console.log(`Found ${albums.length} albums in database\n`);

  // Build cover map
  console.log('Scanning source for covers...');
  const coverMap = new Map();
  function scanForCovers(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const folderName = path.basename(fullPath);
        const normalizedFolder = normalizeAlbumPath(folderName);
        if (!coverMap.has(normalizedFolder) || stat.size > coverMap.get(normalizedFolder).size) {
          coverMap.set(normalizedFolder, { path: fullPath, size: stat.size });
        }
        scanForCovers(fullPath);
      }
    }
  }
  scanForCovers(SOURCE_DIR);
  console.log(`Found ${coverMap.size} cover images\n`);

  if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true });
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  let processed = 0;
  let skipped = 0;
  let totalOriginal = 0;
  let totalResized = 0;

  for (const album of albums) {
    const s3Path = album.path;
    let coverPath = null;

    // Try exact match first
    if (coverMap.has(s3Path)) {
      coverPath = coverMap.get(s3Path).path;
    } else {
      // Fuzzy match
      const s3Words = s3Path.toLowerCase().split(/\s+/);
      for (const [srcPath, coverInfo] of coverMap) {
        const srcWords = srcPath.toLowerCase().split(/\s+/);
        const matches = s3Words.filter(w => w.length > 2 && srcWords.includes(w)).length;
        if (matches >= 2) { coverPath = coverInfo.path; break; }
      }
    }

    if (!coverPath) { skipped++; continue; }

    const jpgPath = findBestCover(coverPath);
    if (!jpgPath) { skipped++; continue; }

    const originalSize = fs.statSync(jpgPath).size;
    totalOriginal += originalSize;

    try {
      const newSize = await resizeAndSave(jpgPath, s3Path);
      totalResized += newSize;
      processed++;
      if (processed <= 30) {
        console.log(`  OK: ${s3Path}`);
        console.log(`      ${(originalSize/1024).toFixed(1)}KB → ${(newSize/1024).toFixed(1)}KB`);
      } else if (processed === 31) {
        console.log(`  ... (more ${albums.length - processed} covers)`);
      }
    } catch (e) {
      console.log(`  ERROR: ${s3Path}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Processed: ${processed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Original: ${(totalOriginal/1024/1024).toFixed(1)} MB`);
  console.log(`Resized: ${(totalResized/1024/1024).toFixed(1)} MB`);
  console.log(`Saved: ${((totalOriginal-totalResized)/1024/1024).toFixed(1)} MB`);

  if (processed === 0) {
    console.log(`\nNo covers to upload.`);
    fs.rmSync(TEMP_DIR, { recursive: true });
    return;
  }

  console.log(`\n=== Uploading to S3 ===`);
  console.log(`Mirroring ${TEMP_DIR} to ${MC_ALIAS}/${S3_BUCKET}/uqt/`);

  try {
    execSync(`mc mirror "${TEMP_DIR}/" "${MC_ALIAS}/${S3_BUCKET}/uqt/"`, { stdio: 'inherit' });
    console.log(`\n✅ Upload complete!`);
  } catch (e) {
    console.log(`Upload failed`);
  }

  fs.rmSync(TEMP_DIR, { recursive: true });
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});