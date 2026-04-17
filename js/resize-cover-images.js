#!/usr/bin/env node
/**
 * Create resized covers and upload directly to S3 via AWS SDK.
 * Usage: node js/resize-cover-images.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const S3_BUCKET = 'sambaraiz';
const S3_REGION = 'hel1';
const TARGET_WIDTH = 200;
const SOURCE_DIR = '/Volumes/EXTRA/bkps/sambaderaiz';

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

const ak = process.env.AWS_ACCESS_KEY_ID;
const sk = process.env.AWS_SECRET_ACCESS_KEY;
if (!ak || !sk) throw new Error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set in .env');

const s3 = new S3Client({
  endpoint: `https://${S3_REGION}.your-objectstorage.com`,
  region: S3_REGION,
  credentials: { accessKeyId: ak, secretAccessKey: sk },
  forcePathStyle: true,
});

function findJpgFiles(dir) {
  const covers = [];
  if (!fs.existsSync(dir)) return covers;
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) covers.push(...findJpgFiles(fullPath));
    else if (['.jpg', '.jpeg'].includes(path.extname(item).toLowerCase()))
      covers.push({ path: fullPath, size: stat.size });
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

async function s3Exists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return true;
  } catch { return false; }
}

async function uploadToS3(buffer, key) {
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg',
  }));
}

async function main() {
  console.log('Loading album database...');
  const dbPath = path.resolve(__dirname, '..', 'js', 'uqt-albums.js');
  const content = fs.readFileSync(dbPath, 'utf8');
  const db = eval('(' + content.replace(/^db\s*=\s*/, '') + ')');
  const albums = db.albums;
  console.log(`Found ${albums.length} albums in database\n`);

  console.log('Scanning source for covers...');
  const coverMap = new Map();
  function scanForCovers(dir) {
    for (const item of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const normalizedFolder = normalizeAlbumPath(path.basename(fullPath));
        if (!coverMap.has(normalizedFolder) || stat.size > coverMap.get(normalizedFolder).size)
          coverMap.set(normalizedFolder, { path: fullPath, size: stat.size });
        scanForCovers(fullPath);
      }
    }
  }
  scanForCovers(SOURCE_DIR);
  console.log(`Found ${coverMap.size} album folders with covers\n`);

  let processed = 0, skipped = 0, alreadyExists = 0, errors = 0;
  let totalOriginal = 0, totalResized = 0;

  for (const album of albums) {
    const s3Path = album.path;
    const s3Key = `uqt/${s3Path}/capa-min.jpg`;
    let coverDir = null;

    if (coverMap.has(s3Path)) {
      coverDir = coverMap.get(s3Path).path;
    } else {
      const s3Words = s3Path.toLowerCase().split(/\s+/);
      for (const [srcPath, coverInfo] of coverMap) {
        const srcWords = srcPath.toLowerCase().split(/\s+/);
        const matches = s3Words.filter(w => w.length > 2 && srcWords.includes(w)).length;
        if (matches >= 2) { coverDir = coverInfo.path; break; }
      }
    }

    if (!coverDir) { skipped++; continue; }

    const jpgPath = findBestCover(coverDir);
    if (!jpgPath) { skipped++; continue; }

    // Skip if already uploaded
    if (await s3Exists(s3Key)) { alreadyExists++; continue; }

    const originalSize = fs.statSync(jpgPath).size;
    totalOriginal += originalSize;

    try {
      const buffer = await sharp(jpgPath)
        .resize(TARGET_WIDTH, null, { withoutEnlargement: true, fit: 'inside' })
        .jpeg({ quality: 80 })
        .toBuffer();

      await uploadToS3(buffer, s3Key);
      totalResized += buffer.length;
      processed++;
      if (processed <= 30)
        console.log(`  OK: ${s3Path} (${(originalSize/1024).toFixed(1)}KB → ${(buffer.length/1024).toFixed(1)}KB)`);
      else if (processed === 31)
        console.log(`  ... (showing first 30)`);
    } catch (e) {
      console.error(`  ERROR: ${s3Path}: ${e.name} ${e.message}`);
      errors++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Uploaded:      ${processed}`);
  console.log(`Already exist: ${alreadyExists}`);
  console.log(`Skipped:       ${skipped} (no source cover found)`);
  console.log(`Errors:        ${errors}`);
  if (processed > 0) {
    console.log(`Original:      ${(totalOriginal/1024/1024).toFixed(1)} MB`);
    console.log(`Resized:       ${(totalResized/1024/1024).toFixed(1)} MB`);
    console.log(`Saved:         ${((totalOriginal-totalResized)/1024/1024).toFixed(1)} MB`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
